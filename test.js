import test from 'ava';
import fn from './';
import etoa from 'events-to-array';

const isEventEmitter = obj => obj && typeof obj.emit === 'function' && typeof obj.on === 'function';

function setup() {
	function createHandler() {
		function handler(eventEmitter, doneCallback, ...args) {
			handler.callCount++;

			if (handler.pending) {
				throw new Error('pending');
			}

			handler.pending = true;
			handler.eventEmitter = eventEmitter;
			handler.args = args;

			handler.doneCallback = function () {
				if (!handler.pending) {
					throw new Error('not pending');
				}
				handler.pending = false;
				handler.eventEmitter = handler.args = handler.doneCallback = null;
				doneCallback(...arguments);
			};
		}

		handler.callCount = 0;
		handler.pending = false;
		createHandler.handlers.push(handler);
		return handler;
	}

	const handlers = createHandler.handlers = [];

	createHandler.handlerCount = () => handlers.length;
	createHandler.callCounts = () => handlers.map(handler => handler.callCount);
	createHandler.args = i => i === undefined ? handlers.map(handler => handler.args) : handlers[i].args;
	createHandler.eventEmitter = i => handlers[i].eventEmitter;
	createHandler.doneCallback = i => handlers[i].doneCallback;

	return createHandler;
}

test('create gets called the first time a handler is needed', t => {
	const create = setup();
	const call = fn(create);
	t.is(create.handlerCount(), 0);
	call();
	t.is(create.handlerCount(), 1);
});

test('create gets called up to "limit" times', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	t.is(create.handlerCount(), 1);
	call();
	t.is(create.handlerCount(), 2);
	call();
	t.is(create.handlerCount(), 3);
	call();
	t.is(create.handlerCount(), 3);
});

test('up to "limit" handlers are called immediately', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	t.same(create.callCounts(), []);
	call();
	t.same(create.callCounts(), [1]);
	call();
	t.same(create.callCounts(), [1, 1]);
	call();
	t.same(create.callCounts(), [1, 1, 1]);
	call();
	t.same(create.callCounts(), [1, 1, 1]);
});

test('calling doneCallback will execute newly available handler (first handler)', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	call();
	call();
	t.same(create.callCounts(), [1, 1, 1]);
	create.handlers[0].doneCallback();
	t.same(create.callCounts(), [2, 1, 1]);
});

test('calling doneCallback will execute newly available handler (second handler)', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	call();
	call();
	t.same(create.callCounts(), [1, 1, 1]);
	create.handlers[1].doneCallback();
	t.same(create.callCounts(), [1, 2, 1]);
});

test('calling doneCallback will execute newly available handler (third handler)', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	call();
	call();
	t.same(create.callCounts(), [1, 1, 1]);
	create.handlers[2].doneCallback();
	t.same(create.callCounts(), [1, 1, 2]);
});

test('if a handler is returned with `doneCallback` before limit is reached, it will be used instead of creating', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	t.same(create.callCounts(), [1]);
	create.handlers[0].doneCallback();
	call();
	t.same(create.callCounts(), [2]);
});

test('if two handlers are returned with `doneCallback` before limit is reached, they will be used instead of creating', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	t.same(create.callCounts(), [1, 1]);
	create.handlers[1].doneCallback();
	create.handlers[0].doneCallback();
	call();
	call();
	t.same(create.callCounts(), [2, 2]);
});

test('handlers are reused on a "first returned" basis', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	t.same(create.callCounts(), [1, 1]);
	create.handlers[1].doneCallback();
	call();
	t.same(create.callCounts(), [1, 2]);
});

test('after handlers are returned, pool will continue to grow as needed to reach limit', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	create.handlers[1].doneCallback();
	call();
	call();
	t.same(create.callCounts(), [1, 2, 1]);
});

test('throws if create does not return a function', t => {
	const call = fn(() => 3);
	t.throws(() => call());
});

test('new args are passed to handler on doneCallback (first handler)', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call('a');
	call('b');
	call('c');
	call('d');
	t.same(create.args(), [['a'], ['b'], ['c']]);
	create.handlers[0].doneCallback();
	t.same(create.args(), [['d'], ['b'], ['c']]);
});

test('new args are passed to handler on doneCallback (second handler)', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call('a');
	call('b');
	call('c');
	call('d');
	t.same(create.args(), [['a'], ['b'], ['c']]);
	create.handlers[1].doneCallback();
	t.same(create.args(), [['a'], ['d'], ['c']]);
});

test('new args are passed to handler on doneCallback (third handler)', t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call('a');
	call('b');
	call('c');
	call('d');
	t.same(create.args(), [['a'], ['b'], ['c']]);
	create.handlers[2].doneCallback();
	t.same(create.args(), [['a'], ['b'], ['d']]);
});

test('passes an event emitter to the created callback', t => {
	const create = setup();
	const call = fn(create);
	call();
	t.true(isEventEmitter(create.eventEmitter(0)));
});

test('returns an event emitter', t => {
	const call = fn(() => () => {});
	const ee = call();
	t.true(isEventEmitter(ee));
});

test('calls handler with arguments', t => {
	const create = setup();
	const call = fn(create);
	call(1, 2, 3);
	t.same(create.handlers[0].args, [1, 2, 3]);
});

test('returned event emitter is tied to the one passed to the handler', t => {
	const create = setup();
	const call = fn(create, {limit: 2});

	const e1 = etoa(call());
	const e2 = etoa(call());

	create.eventEmitter(0).emit('foo', 1, 2);
	create.eventEmitter(1).emit('bar', 3, 4);

	t.same(e1, [['foo', 1, 2]]);
	t.same(e2, [['bar', 3, 4]]);
});

test('new event emitter is used for each call to handler', t => {
	const create = setup();
	const call = fn(create, {limit: 1});

	const e1 = etoa(call());
	const e2 = etoa(call());

	create.eventEmitter(0).emit('foo', 1, 2);
	create.doneCallback(0)();
	create.eventEmitter(0).emit('bar', 3, 4);

	t.same(e1, [['foo', 1, 2]]);
	t.same(e2, [['bar', 3, 4]]);
});
