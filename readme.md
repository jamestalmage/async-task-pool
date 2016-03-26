# async-task-pool [![Build Status](https://travis-ci.org/jamestalmage/async-task-pool.svg?branch=master)](https://travis-ci.org/jamestalmage/async-task-pool)

> A concurrency throttle for async tasks.


## Install

```
$ npm install --save async-task-pool
```


## Usage

```js
const asyncTaskPool = require('async-task-pool');

// This is called at most `options.limit` times:
function createAsyncTaskHandler() {
  // Create an expensive resource that can be reused across multiple calls to the same handler.
  const cp1 = childProcess.fork('./some/path');

  return function asyncTaskHandler(eventEmitter, done, ...additionalArgs) {
    // a new event emitter is created for every task, use it to communicate progress:
    eventEmitter.emit('starting');
    // do some async stuff - note that you can pass custom arguments to the handler
    cp.send({'messageData': additionalArgs});

    cp.on('message', function (data) {
      if (data.result) {
        // call `done()` to mark the end of this handlers run. If there are queued tasks, they will be called.
        done();
      }
    });
  }
}

const enqueue = asyncTaskPool(createAsyncTaskHandler, {limit: 1});

// consume the throttled async task by passing in args and listening to events on the returned emitter.
const eventEmitter1 = enqueue('arg1', 'arg2');
eventEmitter1.on('foo', ...);

const eventEmitter2 = enqueue('arg2', 'arg3');
eventEmitter2.on('foo', ...);
```


## API

### asyncTaskPool(createHandler, [options])

Returns a `enqueue` function which is used to schedule async events for execution by the handlers.

#### createHandler

Type: `callback()`

Called with no arguments. It is called once every time a new task handler is required. It will be called at most `options.limit` times. After the limit is reached, no new handlers will be created. Instead, handlers will be reused as they free themselves by calling the `done` callback.

The return value should be a `handlerCallback`, with the following signature:

`handlerCallback(eventEmitter, done, ...additionalArgs)`

##### eventEmitter

A new `EventEmitter` is created when a task is scheduled using the `enqueue` function. It is returned synchronously from the `enqueu` function, but will not emit any events until passed to a handler. When a handler becomes available, the stored `eventEmitter` is passed as the first argument to the handler.

This `eventEmitter` is used as the main communication channel between the consumer of the throttled async task, and the task handler. As such, the consumer should not need to care which handler is servicing the task request, nor should it care if a handler was available immediately or after some delay.

##### done

Since handlers are just functions which may be called multiple times, they must notify when tasks are complete and they are ready to be recalled by invoking the `done` callback. The `done` callback is passed as the second argument to the handler. It is up to the handler to ensure it is always called.

##### ...additionalArgs

Any arguments passed to `enqueue` will be spread as additional arguments to the handler (after `eventEmitter` and `done`).

#### options

##### limit

Type: `number`<br>
Default: `1`

The maximum number of handlers that will ever be created. Once the limit is reached, further requests will be queued until handlers free themselves by calling the `done` callback.

## License

MIT © [James Talmage](http://github.com/jamestalmage)
