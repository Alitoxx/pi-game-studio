#include "GameGameMode.h"
#include "GameCharacter.h"
#include "UObject/ConstructorHelpers.h"

AGameGameMode::AGameGameMode()
{
	DefaultPawnClass = AGameCharacter::StaticClass();
}
