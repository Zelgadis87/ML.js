
## v1.2.0 (2019/09/21 08:40)
- Improved and clarified stopping algorithm handling of in-progress modules
- Code refactoring

## v1.1.5 (2019/09/16 13:12)
- Updated dependencies

## v1.1.4 (2018/12/28 18:03)
- Refactor: Changed how the register method works internally
- Refactor: Optimized internal module dependencies storage
- Fix: Can now be imported as ES6 module

## v1.1.3 (2018/11/10 12:39)
- Fix: Import as ES6 module now works correctly (2nd attempt)

## v1.1.2 (2018/11/02 13:31)
- Fix: Fixed potential issue when importing from ES6 module

## v1.1.1 (2018/08/18 21:26)
- Improve: Improved tests
- Fix: Removed not working bitHound badge from README

## v1.1.0 (2018/08/18 21:02)
- New: When registering a file, allow value objects to be registered

## v1.0.3 (2018/03/24 00:52)
- Meta: Added quality badges to README.md
- Fix: 3rd argument of register could be misinterpeted as an object
- Fix: Restored test coverage functionality when launched from npm-versionator

## v1.0.1 (2018/03/11 17:02)
- Updated dependencies

## v1.0.0 (2018/03/11 16:50)
- Breaking change: ModuleLoader.resolve is not an async method anymore
- Change: Allow anonymous modules to not return a value
- Improved: Test coverage

## v0.7.10 (2018/03/11 14:22)
- Fix: Modules registered using the minimal configuration will now start correctly
- Fix: Prevent registration of modules on an already started Loader

## v0.7.9 (2018/03/11 12:00)
- Feature: Allow unanymous modules when using Object syntax registration

## v0.7.4 (2017/11/13 21:27)
- Fix: Resolved an issue in the stop method where promises were not correctly handled

## v0.7.3 (2017/11/13 21:02)
- Fix: Use Bluebird promises in resolve method

## v0.7.2 (2017/11/11 14:50)
- Change: ModuleLoader.resolve is now an async method

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