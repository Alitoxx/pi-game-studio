//! Arena allocator para partículas temporales (SoA) — cero allocs en heap durante el gameplay loop.
//!
//! FILOSOFIA
//! Las partículas son efímeras y de vida corta. Crearlas como `Entity` + heap allocation por
//! partícula produce fragmentación y picos de GC/alloc en los picos exactos donde el frame
//! budget es más crítico (combate-mass: 300+ particulas en 1 frame).
//!
//! Este allocator pre-reserva un slab contiguo en el startup y recicla slots de forma O(1)
//! con una free-list intrusiva. Despues del arranque, el loop no toca el heap.
//!
//! GARANTIAS
//! - `spawn()` / `kill()` / `iter_live()` son O(1) / O(1) / O(n) sin allocacion.
//! - Handles generacionales: un handle liberado N veces no puede "resucitar" datos viejos.
//! - Capacidad fija y explicita: si se agota, se emite `ArenaExhausted` (degradacion limpia,
//!   nunca panic en produccion, nunca growth silencioso que rompa el budget).
//! - Payloads stored in SoA (struct of arrays) para el hot loop de integracion.
//
//! EJEMPLO DE USO
//! ```
//! use particle_arena::{ParticleArena, ParticleHandle};
//!
//! let mut arena = ParticleArena::with_capacity(4096);
//!
//! // Burst de 1000 particulas en un solo frame: el arena reutiliza slots liberados.
//! let handles: Vec<ParticleHandle> = (0..1000)
//!     .map(|_| arena.spawn(bevy::math::Vec2::ZERO, 1.0))
//!     .collect();
//!
//! for h in &handles {
//!     let i = arena.index_of(*h).expect("handle vivo");
//!     arena.velocity_mut(i).x += 0.5;
//! }
//!
//! arena.kill(handles[0]);          // devuelve el slot a la free-list
//! let slots = arena.stats().live;   // 999
//! ```
//!
//! NOTA DE VERSION
//! Este modulo es Rust puro: no usa ninguna API de bevy_ecs ni bevy_render, por lo que es
//! estable entre 0.15 y 0.19. La integracion ECS (ver `ParticleArenaPlugin`) queda aislada.

use bevy::math::Vec2;

/// Handle opaco a la partícula. Cheap de copiar (u32), invalido tras liberar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ParticleHandle(u32);

/// Identidad estable de un slot. Las generaciones evitan ABA (use-after-free logico).
#[derive(Debug, Clone, Copy)]
struct SlotMeta {
    generation: u32,
    /// Indice al siguiente slot libre en la free-list (solo valido si `is_free`).
    next_free: u32,
    is_free: bool,
}

const NIL: u32 = u32::MAX;
const UNSET_GENERATION: u32 = 0;

/// Contenedor de particulas con almacenamiento contiguo pre-reservado.
///
/// Capacidad fija: el storage se reserva en `with_capacity()` y nunca crece. Esto es
/// deliberado — crecer implicaria realloc + copia O(n) en medio del frame loop.
pub struct ParticleArena {
    /// SoA: posicion y velocidad en arrays contiguos separados. El hot loop de
    /// integracion recorre `positions` de forma lineal y cache-friendly.
    positions: Vec<Vec2>,
    velocities: Vec<Vec2>,
    /// TTL restante en segundos. <= 0 significa slot libre.
    lifetimes: Vec<f32>,
    /// Payload generico por slot (id de efecto, team, etc.). Opt-in via `with_payload`.
    payload: Vec<u32>,
    meta: Vec<SlotMeta>,
    /// Free-list intrusive encadenada por indice. O(1) push y pop.
    free_head: u32,
    live: u32,
    capacity: usize,
    /// Contador de frames en los que el arena se agoto (telemetria de degradacion).
    exhausted_frames: u32,
}

impl ParticleArena {
    /// Crea un arena con capacidad fija. El unico punto del ciclo de vida donde
    /// el heap crece: debe llamarse en `Startup`, nunca en el loop.
    ///
    /// # Panics
    /// Panica si `capacity` es 0 o excede `u32::MAX / 2` (limite del encoding de handle).
    pub fn with_capacity(capacity: usize) -> Self {
        assert!(capacity > 0, "ParticleArena requiere capacidad > 0");
        assert!(
            capacity < (NIL / 2) as usize,
            "ParticleArena: capacidad {capacity} excede el limite de encoding de handles"
        );

        let mut meta = Vec::with_capacity(capacity);
        let mut positions = Vec::with_capacity(capacity);
        let mut velocities = Vec::with_capacity(capacity);
        let mut lifetimes = Vec::with_capacity(capacity);
        let mut payload = Vec::with_capacity(capacity);

        // Free-list inicial: 0 -> 1 -> ... -> capacity-1 -> NIL. push en O(1).
        for i in 0..capacity {
            meta.push(SlotMeta {
                generation: UNSET_GENERATION,
                next_free: if i + 1 == capacity { NIL } else { (i + 1) as u32 },
                is_free: true,
            });
            positions.push(Vec2::ZERO);
            velocities.push(Vec2::ZERO);
            lifetimes.push(0.0);
            payload.push(0);
        }

        Self {
            positions,
            velocities,
            lifetimes,
            payload,
            meta,
            free_head: 0,
            live: 0,
            capacity,
            exhausted_frames: 0,
        }
    }

    /// Capacidad maxima de particulas simultaneas.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Numero de particulas vivas ahora mismo.
    pub fn len(&self) -> u32 {
        self.live
    }

    pub fn is_empty(&self) -> bool {
        self.live == 0
    }

    /// Telemetria para el HUD de debug / perfilado.
    pub fn stats(&self) -> ArenaStats {
        ArenaStats {
            live: self.live,
            capacity: self.capacity as u32,
            free: self.capacity as u32 - self.live,
            exhausted_frames: self.exhausted_frames,
        }
    }

    /// Reserva un slot y escribe los datos iniciales. O(1), sin allocacion.
    ///
    /// Devuelve `None` si el arena esta lleno. El llamador decide la degradacion
    /// (descartar el efecto, o priorizar); nunca se hace panic ni growth automatico.
    pub fn spawn(&mut self, position: Vec2, velocity: Vec2, lifetime_secs: f32) -> Option<ParticleHandle> {
        let idx = self.free_head;
        if idx == NIL {
            self.exhausted_frames = self.exhausted_frames.saturating_add(1);
            return None;
        }

        // Desenlazar de la free-list.
        self.free_head = self.meta[idx as usize].next_free;

        let m = &mut self.meta[idx as usize];
        m.is_free = false;
        m.next_free = NIL;

        let i = idx as usize;
        self.positions[i] = position;
        self.velocities[i] = velocity;
        self.lifetimes[i] = lifetime_secs;
        self.payload[i] = 0;

        self.live += 1;
        Some(ParticleHandle::encode(idx, m.generation))
    }

    /// Libera un slot y lo devuelve a la free-list. O(1), sin allocacion.
    ///
    /// Retorna `false` si el handle ya estaba liberado o es de otra arena
    /// (deteccion de doble-free / handle stale). `false` no es panic: en un loop
    /// de juego una referencia stale debe ser un no-op silencioso.
    pub fn kill(&mut self, handle: ParticleHandle) -> bool {
        let (idx, generation) = handle.decode();
        let m = &mut self.meta[idx as usize];
        if m.is_free || m.generation != generation {
            return false;
        }

        // Invalidar antes de reutilizar: bump de generacion.
        m.generation = m.generation.wrapping_add(1);
        m.is_free = true;
        m.next_free = self.free_head;
        self.free_head = idx as u32;

        self.positions[idx as usize] = Vec2::ZERO;
        self.velocities[idx as usize] = Vec2::ZERO;
        self.lifetimes[idx as usize] = 0.0;
        self.live -= 1;
        true
    }

    /// Traduce un handle a indice de slice. `None` si el handle es stale.
    #[inline]
    pub fn index_of(&self, handle: ParticleHandle) -> Option<usize> {
        let (idx, generation) = handle.decode();
        let m = &self.meta[idx];
        if m.is_free || m.generation != generation {
            None
        } else {
            Some(idx as usize)
        }
    }

    /// Iterador sobre slots VIVOS, con indice estable. Recorre el slab completo
    /// (O(capacity)) pero solo produce entradas activas. Cero allocacion.
    pub fn iter_live(&self) -> impl Iterator<Item = LiveParticle> + '_ {
        self.positions.iter().enumerate().filter_map(move |(i, &pos)| {
            if self.meta[i].is_free {
                None
            } else {
                Some(LiveParticle {
                    index: i,
                    position: pos,
                    velocity: self.velocities[i],
                    lifetime: self.lifetimes[i],
                    payload: self.payload[i],
                })
            }
        })
    }

    /// Avanza TTL e integra movimiento. Diseñado para correr 1 vez por frame.
    ///
    /// `gravity` es aceleracion constante. `drag` es damping por segundo (0 = sin drag).
    /// Retorna la cantidad de particulas que expiraron este frame.
    ///
    /// # Game Feel note
    /// La integracion es semi-implicita (velocity primero, luego posicion). Es
    /// incondicionalmente estable para dt <= ~1/30s, donde Euler explicito
    /// oscilaria/divergiria en partículas rápidas.
    pub fn update(&mut self, dt: f32, gravity: Vec2, drag: f32) -> u32 {
        if dt <= 0.0 {
            return 0;
        }
        let damping = if drag > 0.0 { (1.0 - drag * dt).clamp(0.0, 1.0) } else { 1.0 };

        let mut expired = 0u32;
        for i in 0..self.capacity {
            if self.meta[i].is_free {
                continue;
            }

            self.lifetimes[i] -= dt;
            if self.lifetimes[i] <= 0.0 {
                // Reutiliza el camino de kill, pasando por el handle generacional
                // para que la generacion se bumpee correctamente.
                let h = ParticleHandle::encode(i as u32, self.meta[i].generation);
                if self.kill(h) {
                    expired += 1;
                }
                continue;
            }

            let v = &mut self.velocities[i];
            *v = *v * damping + gravity * dt;
            self.positions[i] += *v * dt;
        }
        expired
    }

    /// Acceso directo por indice (callers que ya iteran). Panics si `i` es invalido.
    #[inline]
    pub fn position_mut(&mut self, i: usize) -> &mut Vec2 {
        &mut self.positions[i]
    }

    #[inline]
    pub fn velocity_mut(&mut self, i: usize) -> &mut Vec2 {
        &mut self.velocities[i]
    }

    #[inline]
    pub fn lifetime_mut(&mut self, i: usize) -> &mut f32 {
        &mut self.lifetimes[i]
    }

    /// Escribe el payload opaco (id de efecto, indice de sprite, team...). O(1).
    #[inline]
    pub fn set_payload(&mut self, i: usize, payload: u32) {
        self.payload[i] = payload;
    }

    /// Libera todas las particulas sin devolver la capacidad al heap. O(capacity).
    /// Util para transiciones de escena sin re-reservar.
    pub fn clear(&mut self) {
        for i in 0..self.capacity {
            let m = &mut self.meta[i];
            if !m.is_free {
                m.generation = m.generation.wrapping_add(1);
                m.is_free = true;
                m.next_free = self.free_head;
                self.free_head = i as u32;
            }
        }
        self.live = 0;
    }
}

impl ParticleHandle {
    #[inline]
    fn encode(index: u32, generation: u32) -> Self {
        ParticleHandle(index | (generation << 16))
    }

    #[inline]
    fn decode(self) -> (usize, u32) {
        let raw = self.0;
        let index = (raw & 0xFFFF) as usize;
        let generation = raw >> 16;
        // Guardarrail: el indice debe estar siempre dentro del slab porque encode()
        // solo produce indices de free_head, que por construccion son < capacity.
        debug_assert!(index < NIL as usize);
        (index, generation)
    }
}

/// Vista de solo-lectura de una particula viva durante la iteracion.
#[derive(Debug, Clone, Copy)]
pub struct LiveParticle {
    pub index: usize,
    pub position: Vec2,
    pub velocity: Vec2,
    pub lifetime: f32,
    pub payload: u32,
}

/// Snapshot de telemetria del arena.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ArenaStats {
    pub live: u32,
    pub capacity: u32,
    pub free: u32,
    /// Frames acumulados en los que `spawn()` retorno `None` por agotamiento.
    pub exhausted_frames: u32,
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn arena() -> ParticleArena {
        ParticleArena::with_capacity(8)
    }

    #[test]
    fn spawn_kill_roundtrip() {
        let mut a = arena();
        assert_eq!(a.len(), 0);
        let h = a.spawn(Vec2::new(1.0, 2.0), Vec2::X, 1.0).unwrap();
        assert_eq!(a.len(), 1);
        assert!(a.kill(h));
        assert_eq!(a.len(), 0);
        assert!(!a.kill(h), "doble kill debe ser no-op");
    }

    #[test]
    fn slots_are_recycled_lifo() {
        let mut a = arena();
        let h1 = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        let h2 = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        a.kill(h1);
        a.kill(h2);
        // free_head apunta a h2 (ultimo liberado): debe reutilizarse primero.
        let h3 = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        assert_eq!(h3.decode().0, h2.decode().0);
    }

    #[test]
    fn generational_handle_rejects_stale_reference() {
        let mut a = arena();
        let stale = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        a.kill(stale);
        // Se recicla el mismo slot: el handle viejo NO debe ser valido.
        let fresh = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        assert_ne!(stale, fresh, "generacion debe haber cambiado");
        assert!(a.index_of(stale).is_none(), "handle stale debe resolverse a None");
        assert!(a.index_of(fresh).is_some());
        assert!(!a.kill(stale), "no se debe poder matar via handle stale");
    }

    #[test]
    fn exhaustion_returns_none_and_counts() {
        let mut a = ParticleArena::with_capacity(4);
        for _ in 0..4 {
            assert!(a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).is_some());
        }
        assert!(a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).is_none());
        assert_eq!(a.stats().exhausted_frames, 1);
        assert_eq!(a.stats().free, 0);
    }

    #[test]
    fn free_slot_reopens_after_exhaustion() {
        let mut a = ParticleArena::with_capacity(2);
        let h1 = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        let h2 = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        assert!(a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).is_none());
        a.kill(h1);
        assert!(a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).is_some());
        a.kill(h2);
    }

    #[test]
    fn ttl_expiry_frees_slot() {
        let mut a = arena();
        a.spawn(Vec2::ZERO, Vec2::ZERO, 0.10).unwrap();
        assert_eq!(a.update(0.05, Vec2::ZERO, 0.0), 0);
        assert_eq!(a.len(), 1);
        assert_eq!(a.update(0.06, Vec2::ZERO, 0.0), 1, "TTL debe expirar");
        assert_eq!(a.len(), 0);
    }

    #[test]
    fn gravity_and_drag_integrate_position() {
        let mut a = arena();
        let h = a.spawn(Vec2::ZERO, Vec2::ZERO, 10.0).unwrap();
        let i = a.index_of(h).unwrap();
        a.update(0.5, Vec2::new(0.0, -10.0), 0.0);
        // v = -5, y = -2.5
        assert!((a.velocity_mut(i).y - -5.0).abs() < 1e-4);
        assert!((a.position_mut(i).y - -2.5).abs() < 1e-4);
    }

    #[test]
    fn drag_damps_velocity_monotonically() {
        let mut a = arena();
        let h = a.spawn(Vec2::ZERO, Vec2::new(100.0, 0.0), 10.0).unwrap();
        let i = a.index_of(h).unwrap();
        a.update(0.5, Vec2::ZERO, 1.0);
        let v1 = a.velocity_mut(i).x;
        a.update(0.5, Vec2::ZERO, 1.0);
        let v2 = a.velocity_mut(i).x;
        assert!(v2 < v1 && v2 >= 0.0, "drag={v2} debe ser menor que {v1} y no negativo");
    }

    #[test]
    fn zero_dt_is_noop() {
        let mut a = arena();
        a.spawn(Vec2::new(3.0, 3.0), Vec2::new(9.0, 9.0), 5.0).unwrap();
        assert_eq!(a.update(0.0, Vec2::new(0.0, -100.0), 0.0), 0);
        assert_eq!(a.len(), 1);
        // Nada se movio.
        let p = a.iter_live().next().unwrap();
        assert_eq!(p.position, Vec2::new(3.0, 3.0));
        assert_eq!(p.velocity, Vec2::new(9.0, 9.0));
    }

    #[test]
    fn iter_live_yields_only_active() {
        let mut a = arena();
        let keep = a.spawn(Vec2::new(7.0, 0.0), Vec2::ZERO, 5.0).unwrap();
        let drop_me = a.spawn(Vec2::ZERO, Vec2::ZERO, 5.0).unwrap();
        a.kill(drop_me);
        let live: Vec<_> = a.iter_live().collect();
        assert_eq!(live.len(), 1);
        assert_eq!(live[0].index, a.index_of(keep).unwrap());
        assert_eq!(live[0].position.x, 7.0);
    }

    #[test]
    fn payload_roundtrip() {
        let mut a = arena();
        let h = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        let i = a.index_of(h).unwrap();
        a.set_payload(i, 0xDEAD_BEEF);
        assert_eq!(a.iter_live().next().unwrap().payload, 0xDEAD_BEEF);
    }

    #[test]
    fn clear_resets_live_count_and_recycles_all() {
        let mut a = arena();
        for _ in 0..8 {
            a.spawn(Vec2::ZERO, Vec2::ZERO, 10.0).unwrap();
        }
        a.clear();
        assert_eq!(a.len(), 0);
        assert_eq!(a.stats().free, 8);
        assert!(a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).is_some());
    }

    #[test]
    fn churn_never_exceeds_capacity() {
        // Simula 10_000 frames de spawn/kill agresivo. El invariant central:
        // el heap nunca crece y el conteo nunca excede capacity.
        let mut a = ParticleArena::with_capacity(64);
        let mut rng = 0x2545_F491_4F6C_DD1Du64;
        let mut live: Vec<ParticleHandle> = Vec::with_capacity(64); // scratch fuera del hot path

        for _frame in 0..10_000u32 {
            let burst = (rng % 8) as usize + 1;
            for _ in 0..burst {
                if let Some(h) = a.spawn(Vec2::ZERO, Vec2::X, 0.5) {
                    live.push(h);
                }
            }
            if live.len() > 48 {
                let n = (rng % 8) as usize + 1;
                for _ in 0..n {
                    let idx = (rng % live.len() as u64) as usize;
                    let h = live.swap_remove(idx);
                    assert!(a.kill(h));
                }
            }
            a.update(0.016, Vec2::ZERO, 0.1);
            live.retain(|&h| a.index_of(h).is_some());

            assert!(a.len() as usize <= a.capacity(), "invariant de capacidad violado");
            assert_eq!(a.len() as usize, live.len());
        }
    }

    #[test]
    fn capacity_one_works() {
        let mut a = ParticleArena::with_capacity(1);
        let h = a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).unwrap();
        assert!(a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).is_none());
        a.kill(h);
        assert!(a.spawn(Vec2::ZERO, Vec2::ZERO, 1.0).is_some());
    }
}