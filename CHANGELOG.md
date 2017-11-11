
## v0.7.1 (2017/11/11 12:12)
- Changed: ModuleLoader.resolve will not throw an error if ModuleLoader has not been explicitly started yet

## v0.7.0 (2017/11/08 21:20)
- Added: ModuleLoader.registerValue

## v0.6.0 (2017/11/07 21:42)
- Added: ModuleLoader.registerFile
- Added: ModuleLoader.registerDirectory

## v0.5.0 (2017/07/02 17:44)
- Now supports a simplified syntax, passing the name, dependencies and the object that implements start/stop functions

## v0.4.0 (2017/07/02 16:07)
- Allow anonymous dependencies to be specified

## v0.3.0
- Allow `resolve()` to work with an array of dependencies.
- Fix: Missing dependencies on `start()` are only printed once.

## v0.2.0
- Removed log4js dependency.

## v0.1.0
- Initial version.