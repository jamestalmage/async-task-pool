'use strict';
var EventEmitter = require('events').EventEmitter;

module.exports = function (create, opts) {
	opts = opts || {};
	var limit = opts.limit || 1;
	var pendingRequests = [];
	var pendingHandlers = [];

	function callHandler(handler, request) {
		request[1] = function () {
			pendingHandlers.push(handler);
			next();
		};
		handler.apply(null, request);
	}

	function next() {
		if (pendingRequests.length) {
			if (pendingHandlers.length) {
				callHandler(pendingHandlers.shift(), pendingRequests.pop());
			} else if (limit) {
				limit--;
				callHandler(create(), pendingRequests.pop());
			}
		}
	}

	return function () {
		var request = new Array(arguments.length + 2);
		request[0] = new EventEmitter();

		for (var i = 0; i < arguments.length; i++) {
			request[i + 2] = arguments[i];
		}

		pendingRequests.push(request);
		next();
		return request[0];
	};
};
