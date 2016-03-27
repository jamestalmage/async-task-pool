import test from 'ava';
import etoa from 'events-to-array';
import immediate from 'immediate-promise';
import fn from './';

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

test('create gets called the first time a handler is needed', async t => {
	const create = setup();
	const call = fn(create);
	await immediate();
	t.is(create.handlerCount(), 0);
	call();
	await immediate();
	t.is(create.handlerCount(), 1);
});

test('create gets called up to "limit" times', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	await immediate();
	t.is(create.handlerCount(), 1);
	call();
	await immediate();
	t.is(create.handlerCount(), 2);
	call();
	await immediate();
	t.is(create.handlerCount(), 3);
	call();
	await immediate();
	t.is(create.handlerCount(), 3);
});

test('up to "limit" handlers are called immediately', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	t.same(create.callCounts(), []);
	call();
	await immediate();
	t.same(create.callCounts(), [1]);
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1]);
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1, 1]);
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1, 1]);
});

test('calling doneCallback will execute newly available handler (first handler)', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	call();
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1, 1]);
	create.handlers[0].doneCallback();
	await immediate();
	t.same(create.callCounts(), [2, 1, 1]);
});

test('calling doneCallback will execute newly available handler (second handler)', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	call();
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1, 1]);
	create.handlers[1].doneCallback();
	await immediate();
	t.same(create.callCounts(), [1, 2, 1]);
});

test('calling doneCallback will execute newly available handler (third handler)', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	call();
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1, 1]);
	create.handlers[2].doneCallback();
	await immediate();
	t.same(create.callCounts(), [1, 1, 2]);
});

test('if a handler is returned with `doneCallback` before limit is reached, it will be used instead of creating', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	await immediate();
	t.same(create.callCounts(), [1]);
	create.handlers[0].doneCallback();
	call();
	await immediate();
	t.same(create.callCounts(), [2]);
});

test('if two handlers are returned with `doneCallback` before limit is reached, they will be used instead of creating', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1]);
	create.handlers[1].doneCallback();
	create.handlers[0].doneCallback();
	call();
	call();
	await immediate();
	t.same(create.callCounts(), [2, 2]);
});

test('handlers are reused on a "first returned" basis', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	await immediate();
	t.same(create.callCounts(), [1, 1]);
	create.handlers[1].doneCallback();
	call();
	await immediate();
	t.same(create.callCounts(), [1, 2]);
});

test('after handlers are returned, pool will continue to grow as needed to reach limit', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call();
	call();
	await immediate();
	create.handlers[1].doneCallback();
	call();
	call();
	await immediate();
	t.same(create.callCounts(), [1, 2, 1]);
});

test('throws if create does not return a function', t => {
	const call = fn(() => 3);
	t.throws(() => call());
});

test('new args are passed to handler on doneCallback (first handler)', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call('a');
	call('b');
	call('c');
	call('d');
	await immediate();
	t.same(create.args(), [['a'], ['b'], ['c']]);
	create.handlers[0].doneCallback();
	await immediate();
	t.same(create.args(), [['d'], ['b'], ['c']]);
});

test('new args are passed to handler on doneCallback (second handler)', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call('a');
	call('b');
	call('c');
	call('d');
	await immediate();
	t.same(create.args(), [['a'], ['b'], ['c']]);
	create.handlers[1].doneCallback();
	await immediate();
	t.same(create.args(), [['a'], ['d'], ['c']]);
});

test('new args are passed to handler on doneCallback (third handler)', async t => {
	const create = setup();
	const call = fn(create, {limit: 3});
	call('a');
	call('b');
	call('c');
	call('d');
	await immediate();
	t.same(create.args(), [['a'], ['b'], ['c']]);
	create.handlers[2].doneCallback();
	await immediate();
	t.same(create.args(), [['a'], ['b'], ['d']]);
});

test('passes an event emitter to the created callback', async t => {
	const create = setup();
	const call = fn(create);
	call();
	await immediate();
	t.true(isEventEmitter(create.eventEmitter(0)));
});

test('returns an event emitter', t => {
	const call = fn(() => () => {});
	const ee = call();
	t.true(isEventEmitter(ee));
});

test('calls handler with arguments', async t => {
	const create = setup();
	const call = fn(create);
	call(1, 2, 3);
	await immediate();
	t.same(create.handlers[0].args, [1, 2, 3]);
});

test('returned event emitter is tied to the one passed to the handler', async t => {
	const create = setup();
	const call = fn(create, {limit: 2});

	const e1 = etoa(call());
	const e2 = etoa(call());

	await immediate();
	create.eventEmitter(0).emit('foo', 1, 2);
	create.eventEmitter(1).emit('bar', 3, 4);

	t.same(e1, [['foo', 1, 2]]);
	t.same(e2, [['bar', 3, 4]]);
});

test('new event emitter is used for each call to handler', async t => {
	const create = setup();
	const call = fn(create, {limit: 1});

	const e1 = etoa(call());
	const e2 = etoa(call());

	await immediate();
	create.eventEmitter(0).emit('foo', 1, 2);
	create.doneCallback(0)();
	await immediate();
	create.eventEmitter(0).emit('bar', 3, 4);

	t.same(e1, [['foo', 1, 2]]);
	t.same(e2, [['bar', 3, 4]]);
});

test('handler is not called again until the next event loop', async t => {
	let calls = 0;

	const call = fn(() => (ee, done) => {
		calls++;
		const called = calls;
		setImmediate(() => {
			done();
			t.is(calls, called);
		});
	});

	call();
	call();
});

test('you wont miss events that fire immediately', async t => {
	const call = fn(() => (ee, done) => {
		ee.emit('start');
		done();
	});
	
	const e1 = etoa(call());
	const e2 = etoa(call());
	
	await immediate();
	await immediate();
	t.same(e1, [['start']]);
	t.same(e2, [['start']]);
});
