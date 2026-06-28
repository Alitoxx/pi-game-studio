# Quality Rubric for Skill Testing

## gate Category

| Metric | Description         | PASS Criteria                                                           |
| ------ | ------------------- | ----------------------------------------------------------------------- |
| G1     | Review mode read    | Skill properly handles review mode with read-only access                |
| G2     | Full mode directors | Skill spawns CD-PHASE-GATE, TD-PHASE-GATE, PR-PHASE-GATE, AD-PHASE-GATE |
| G3     | Lean mode           | Skill uses PHASE-GATE only for quick checks                             |
| G4     | Solo mode           | Skill works without director dependencies                               |
| G5     | No auto-advance     | Skill doesn't automatically advance to next skill                       |

## review Category

| Metric | Description          | PASS Criteria                                         |
| ------ | -------------------- | ----------------------------------------------------- |
| R1     | Design validation    | Skill validates design specifications comprehensively |
| R2     | Alignment check      | Skill verifies alignment with project standards       |
| R3     | Risk assessment      | Skill identifies and documents potential design risks |
| R4     | Feedback integration | Skill incorporates stakeholder feedback effectively   |

## utility Category

| Metric | Description       | PASS Criteria                            |
| ------ | ----------------- | ---------------------------------------- |
| U1     | Static compliance | Passes all 7 static mode checks          |
| U2     | Gate mode correct | Properly handles gate mode if applicable |

## team Category

| Metric | Description   | PASS Criteria                                    |
| ------ | ------------- | ------------------------------------------------ |
| T1     | Collaboration | Skill facilitates team collaboration effectively |
| T2     | Communication | Skill provides clear communication channels      |
| T3     | Coordination  | Skill coordinates team activities properly       |
