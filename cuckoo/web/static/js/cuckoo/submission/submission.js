'use strict';

var _InterfaceControllers = require('./components/InterfaceControllers');

var InterfaceControllers = _interopRequireWildcard(_InterfaceControllers);

var _FileTree = require('./components/FileTree');

var FileTree = _interopRequireWildcard(_FileTree);

var _Analysis = require('./components/Analysis');

var Analysis = _interopRequireWildcard(_Analysis);

var _SubmissionTaskTable = require('./components/SubmissionTaskTable');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var default_analysis_options = {
	'machine': 'default',
	'network-routing': 'internet',
	'options': {
		'enable-services': true,
		'enforce-timeout': false,
		'full-memory-dump': false,
		'no-injection': true,
		'process-memory-dump': true,
		'simulated-human-interaction': true
	},
	'package': 'python',
	'priority': 1,
	'timeout': 120,
	'vpn': 'united-states',
	'available_vpns': [],
	'available_machines': []
};

// package field contents - hardcoded options vs auto-detected properties
// gets updated when packages come back that aren;t in this array in the response
// serialization code.
var default_package_selection_options = ['python', 'ie', 'js', 'pdf'];
var routing_prefs = {};

// appends a helper to handlebars for humanizing sizes
Handlebars.registerHelper('file_size', function (text) {
	return new Handlebars.SafeString(FileTree.humanizeBytes(parseInt(text)));
});

$(function () {

	var debugging = window.location.toString().indexOf('#debugging') !== -1;

	if (debugging) {
		console.debug('You run this module in debug mode. to disable it, remove #debugging from the url.');
		console.debug('Clicking analyze will output the JSON results to the console.');
		console.debug('Submitting is unavailable in this mode.');
		$('.flex-grid__footer').css('display', 'none');
	}

	if (document.getElementById('analysis-configuration') !== null) {

		// collects the entire ui of this page
		var analysis_ui = new Analysis.AnalysisInterface({
			container: document.getElementById('analysis-configuration'),
			// specifies the file tree configuration
			filetree: {
				config: {
					label: 'filetree',
					autoExpand: true,
					sidebar: document.getElementById('filetree-detail'),
					nameKey: 'filename', // name of the file name property
					isDirectory: function isDirectory(item) {
						return item.type === 'directory' || item.type === 'container';
					}
				},
				load: {
					url: '/submit/api/filetree',
					method: 'POST',
					params: {
						"submit_id": window.submit_id
					},
					serialize: function serialize(response) {

						// set up defaults for form and settings
						if (response.defaults) {
							default_analysis_options = response.defaults;

							// extract the routing settings and delete
							routing_prefs = default_analysis_options.routing;
							default_analysis_options.routing = routing_prefs.route;

							// format the vpns array to work for the form field, using a 'name-value']
							default_analysis_options.available_vpns = routing_prefs.vpns.map(function (vpn) {
								return {
									name: vpn,
									value: vpn
								};
							});

							// parse the available machines
							default_analysis_options.available_machines = default_analysis_options.machine.map(function (machine) {
								return {
									name: machine,
									value: machine
								};
							});

							// create a 'default=null' value
							default_analysis_options.available_machines.unshift({
								name: 'default',
								value: null
							});

							// set the value to 'default' (or null in this case)
							default_analysis_options.machine = default_analysis_options.available_machines[0].value;
						}

						analysis_ui.originalData = response.files;

						FileTree.FileTree.iterateFileStructure(response.files, function (item) {

							item.per_file_options = $.extend(new Object(), default_analysis_options);
							item.changed_properties = [];

							// machine guess: package options
							// - also preselects the package field if available
							if (item.package) {
								item.per_file_options['package'] = item.package;
								if (default_package_selection_options.indexOf(item.package) == -1) {
									default_package_selection_options.push(item.package);
								}
								item.changed_properties.push('package');
							}

							var parentContainer = FileTree.FileTree.getParentContainerName(item);
							if (parentContainer) item.arcname = parentContainer.filename;
						});

						default_package_selection_options = default_package_selection_options.map(function (opt) {
							return {
								name: opt,
								value: opt
							};
						});

						return response.files;
					}
				},
				transform: {
					file: function file(el, controller) {

						var self = this;

						// this = item
						var _$d = $(el).find('div');
						var size = FileTree.Label('size', FileTree.humanizeBytes(this.size));
						var info = FileTree.Label('info', '<i class="fa fa-info-circle"></i>', 'a');

						// adds the meta data
						_$d.append(info, size);

						if (this.duplicate) {
							var duplicate = FileTree.Label('duplicate', 'duplicate file');
							_$d.append(duplicate);
						}

						$(info).on('click', function (e) {
							e.stopImmediatePropagation();
							controller.detailView(self);
						});

						return el;
					},

					folder: function folder(el, controller) {

						var _$d = $(el).find('div');
						var size = FileTree.Label('size', FileTree.humanizeBytes(FileTree.folderSize(this)));

						if (this.type === 'container') {
							_$d.addClass('archive-container');
						}

						_$d.append(size);

						return el;
					}
				},
				after: {
					selectionView: function selectionView() {},
					detailView: function detailView(el, filetree) {

						var item = this;
						var $per_file_options = $(el).find('.per-file-options')[0];

						if ($per_file_options) {
							var form;

							(function () {

								// sets a value on a field
								var setFieldValue = function setFieldValue(value) {

									var field = fieldName(this.name);

									if (item.changed_properties.indexOf(field) == -1) {
										item.changed_properties.push(field);
									}

									item.per_file_options[field] = value;
								};

								// returns the fieldname as is


								var fieldName = function fieldName(str) {
									var spl = str.split('-');
									spl.splice(-1, 1);
									return spl.join('-');
								};

								form = new InterfaceControllers.Form({
									container: $per_file_options,
									configure: function configure(form) {

										var network = new this.TopSelect({
											name: 'network-routing-' + item.filetree.index,
											title: 'Network Routing',
											doc_link: 'https://cuckoo.sh/docs/installation/host/routing.html',
											default: item.per_file_options['network-routing'],
											options: [{ name: 'none', value: 'none', disabled: routing_prefs['none'] === false }, { name: 'drop', value: 'drop', disabled: routing_prefs['drop'] === false }, { name: 'internet', value: 'internet', disabled: routing_prefs['internet'] === false }, { name: 'inetsim', value: 'inetsim', disabled: routing_prefs['inetsim'] === false }, { name: 'tor', value: 'tor', disabled: routing_prefs['tor'] === false }],
											extra_select: {
												title: 'VPN via',
												name: 'vpn-' + item.filetree.index,
												default: item.per_file_options['vpn'] || undefined,
												disabled: routing_prefs['vpn'] === false || default_analysis_options.available_vpns.length === 0,
												options: default_analysis_options.available_vpns
											}
										}).on('change', function (value) {
											item.per_file_options['network-routing'] = value;
											setFieldValue.call(this, value);
										});

										var pkg = new this.SimpleSelect({
											name: 'package-' + item.filetree.index,
											title: 'Package',
											doc_link: 'https://cuckoo.sh/docs/usage/packages.html',
											default: item.per_file_options['package'],
											options: default_package_selection_options
										}).on('change', function (value) {
											item.per_file_options['package'] = value;
											setFieldValue.call(this, value);
										});

										var priority = new this.TopSelect({
											name: 'piority-' + item.filetree.index,
											title: 'Priority',
											default: parseInt(item.per_file_options['priority']),
											options: [{ name: 'low', value: 0, className: 'priority-s' }, { name: 'medium', value: 1, className: 'priority-m' }, { name: 'high', value: 2, className: 'priority-l' }]
										}).on('change', function (value) {
											item.per_file_options['priority'] = value;
											setFieldValue.call(this, parseInt(value));
										});

										var timeout = new this.TopSelect({
											name: 'timeout-' + item.filetree.index,
											title: 'Timeout',
											default: item.per_file_options['timeout'],
											units: 'seconds',
											options: [{ name: 'short', value: 60, description: '60' }, { name: 'medium', value: 120, description: '120' }, { name: 'long', value: 300, description: '300' }, { name: 'custom', manual: true }]
										}).on('change', function (value) {
											item.per_file_options['timeout'] = value;
											setFieldValue.call(this, value);
										});

										var config = new this.ToggleList({
											name: 'options-' + item.filetree.index,
											title: 'Options',
											extraOptions: true,
											default: item.per_file_options['options'],
											options: [{
												name: 'no-injection',
												label: 'No Injection',
												description: 'Disable behavioral analysis.'
											}, {
												name: 'process-memory-dump',
												label: 'Process Memory Dump'
											}, {
												name: 'full-memory-dump',
												label: 'Full Memory Dump',
												description: 'If the “memory” processing module is enabled, will launch a Volatality Analysis.'
											}, {
												name: 'enforce-timeout',
												label: 'Enforce Timeout'
											}, {
												name: 'simulated-human-interaction',
												label: 'Enable Simulated Human Interaction'
											}, {
												name: 'enable-services',
												label: 'Enable Services',
												description: 'Enable simulated environment specified in the auxiliary configuration.'
											}],
											on: {
												init: function init() {

													/*
             	attach any predefined values to the stack
              */

													var custom = [];

													var default_options = this.options.map(function (item) {
														return item.name;
													});

													for (var default_option in this.default) {
														if (default_options.indexOf(default_option) == -1) {
															custom.push({
																key: default_option,
																value: this.default[default_option]
															});
														}
													}

													this.options_extra_predefined = custom;
												},
												change: function change(value) {
													item.per_file_options['options'] = value;
													setFieldValue.call(this, value);
												}
											}
										});

										var machine = new this.SimpleSelect({
											name: 'machine-' + item.filetree.index,
											title: 'Machine',
											default: item.per_file_options['machine'],
											options: default_analysis_options.available_machines
										}).on('change', function (value) {
											item.per_file_options['machine'] = value;
											setFieldValue.call(this, value);
										});

										form.add([network, [pkg, priority], timeout, config, machine]);

										form.draw();
									}
								});
							})();
						}
					}
				}
			},

			// specifies the form configuration
			form: {
				container: document.getElementById('submission-config'),
				configure: function configure(form) {

					// this configuration allows for dynamic (yes, dynamic) forms

					var network = new this.TopSelect({
						name: 'network-routing',
						title: 'Network Routing',
						default: default_analysis_options['routing'],
						doc_link: 'https://cuckoo.sh/docs/installation/host/routing.html',
						options: [{ name: 'none', value: 'none', disabled: routing_prefs['none'] === false }, { name: 'drop', value: 'drop', disabled: routing_prefs['drop'] === false }, { name: 'internet', value: 'internet', disabled: routing_prefs['internet'] === false }, { name: 'inetsim', value: 'inetsim', disabled: routing_prefs['inetsim'] === false }, { name: 'tor', value: 'tor', disabled: routing_prefs['tor'] === false }],
						extra_select: {
							title: 'VPN via',
							name: 'vpn',
							disabled: routing_prefs['vpn'] === false || default_analysis_options.available_vpns.length === 0,
							on: {
								change: function change() {
									// console.log('vpn changed');
								}
							},
							options: default_analysis_options.available_vpns
						}
					});

					var pkg = new this.SimpleSelect({
						name: 'package',
						title: 'Package',
						doc_link: 'https://cuckoo.sh/docs/usage/packages.html',
						default: default_analysis_options['package'],
						options: default_package_selection_options
					});

					var priority = new this.TopSelect({
						name: 'priority',
						title: 'Priority',
						default: default_analysis_options['priority'],
						options: [{ name: 'low', value: 0, className: 'priority-s' }, { name: 'medium', value: 1, className: 'priority-m' }, { name: 'high', value: 2, className: 'priority-l' }]
					});

					var config = new this.ToggleList({
						name: 'options',
						title: 'Options',
						default: default_analysis_options['options'],
						extraOptions: true,
						options: [{
							name: 'no-injection',
							label: 'No Injection',
							description: 'Disable behavioral analysis.'
						}, {
							name: 'process-memory-dump',
							label: 'Process Memory Dump'
						}, {
							name: 'full-memory-dump',
							label: 'Full Memory Dump',
							description: 'If the “memory” processing module is enabled, will launch a Volatality Analysis.'
						}, {
							name: 'enforce-timeout',
							label: 'Enforce Timeout'
						}, {
							name: 'simulated-human-interaction',
							label: 'Enable Simulated Human Interaction',
							selected: true
						}, {
							name: 'enable-services',
							label: 'Enable Services',
							description: 'Enable simulated environment specified in the auxiliary configuration.'
						}]
					});

					var machine = new this.SimpleSelect({
						name: 'machine',
						title: 'Machine',
						default: default_analysis_options['machine'],
						options: default_analysis_options['available_machines']
					});

					var timeout = new this.TopSelect({
						name: 'timeout',
						title: 'Timeout',
						default: default_analysis_options['timeout'],
						units: 'seconds',
						options: [{ name: 'short', value: 60, description: '60' }, { name: 'medium', value: 120, description: '120' }, { name: 'long', value: 300, description: '300' }, { name: 'custom', manual: true }]
					});

					// an array inside this array will render the elements in a split view
					form.add([network, [pkg, priority], timeout, config, machine]);
					form.draw();

					// this gets fired EVERY time one of the fields
					// insdie the form gets updated. it sends 
					// back an object with all the current values of 
					// the form instance.
					form.on('change', function (values) {

						function compareAndOverwrite(item) {

							for (var val in values) {
								if (item.changed_properties && item.changed_properties.indexOf(val) == -1) {
									item.per_file_options[val] = values[val];
								}
							}
						}

						analysis_ui.filetree.each(function (item) {
							compareAndOverwrite(item);
						});

						// update any active detail views, respecting custom presets made
						// by the user. Actually 're-render' the current detail view to persist
						// default settings 'asynchonously' - as you would expect.
						if (analysis_ui.filetree.detailViewActive) {
							var active_index = analysis_ui.filetree.activeIndex;
							analysis_ui.filetree.detailView(analysis_ui.filetree.getIndex(active_index));
						}
					});
				}
			},
			// base configuration for the dnd uploader
			dndupload: {
				endpoint: '/submit/api/presubmit',
				target: 'div#dndsubmit',
				template: HANDLEBARS_TEMPLATES['dndupload'],
				success: function success(data, holder) {

					$(holder).removeClass('dropped');
					$(holder).addClass('done');

					// fake timeout
					setTimeout(function () {
						window.location.href = data.responseURL;
					}, 1000);
				},
				error: function error(uploader, holder) {
					$(holder).addClass('error');
				},
				progress: function progress(value, holder) {
					// thisArg is bound to the uploader
					if (value > 50 && !$(holder).hasClass('progress-half')) {
						$(holder).addClass('progress-half');
					}

					$(this.options.target).find(".alternate-progress").css('transform', 'translateY(' + (100 - value) + '%)');
				},
				dragstart: function dragstart(uploader, holder) {
					holder.classList.add('hover');
				},
				dragend: function dragend(uploader, holder) {
					holder.classList.remove('hover');
				},
				drop: function drop(uploader, holder) {
					holder.classList.remove('hover');
					holder.classList.add('dropped');
				}
			}
		});

		$('#start-analysis').bind('click', function (e) {

			e.preventDefault();

			$(".page-freeze").addClass('in');

			var json = analysis_ui.getData({
				'submit_id': window.submit_id
			}, true);

			if (debugging) {
				console.log(JSON.parse(json));
				return;
			}

			$.ajax({
				url: '/submit/api/submit',
				type: 'POST',
				dataType: 'json',
				contentType: "application/json; charset=utf-8",
				data: json,
				success: function success(data) {
					if (data.status === true) {
						// redirect to submission success page
						window.location = '/submit/post/' + data.submit_id;
					} else {
						alert("Submission failed: " + data.message);
						$('.page-freeze').removeClass('in');
					}
				},
				error: function error() {
					console.log(arguments);
					alert('submission failed! see the console for details.');
					$('.page-freeze').removeClass('in');
				}
			});
		});

		$("#reset-options").bind('click', function (e) {
			e.preventDefault();
		});

		$(".upload-module .grouped-buttons a").on('shown.bs.tab', function (e) {
			$(e.target).parent().find('a').removeClass('active');
			$(this).addClass('active');
		});

		// taken from the previous submit functionality
		$("input#urlhash").click(function () {

			var urls = $("textarea#presubmit_urlhash").val();
			if (urls == "") {
				return;
			}

			CuckooWeb.api_post("/submit/api/presubmit", {
				"data": urls,
				"type": "strings"
			}, function (data) {
				CuckooWeb.redirect("/submit/pre/" + data.submit_id);
			}, function (data) {
				console.log("err: " + data);
			});
		});
	}

	// submission task summary init
	if (document.getElementById('submission-task-table') !== null) {
		var taskTable = new _SubmissionTaskTable.SubmissionTaskTable({
			el: document.getElementById('submission-task-table'),
			task_ids: task_ids,
			debug: false, // set to true to do 10 calls max and stop
			refreshRate: 2500,
			onRender: function onRender(el) {
				el.find('tbody > tr.finished').bind('click', function () {
					var id = $(this).data('taskId');
					window.location = '/analysis/' + id;
				});
			}
		});
	}
});
//# sourceMappingURL=submission.js.map