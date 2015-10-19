/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.20 Copyright (c) 2010-2015, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.20',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite an existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; i < ary.length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i === 1 && ary[2] === '..') || ary[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI, normalizedBaseParts,
                baseParts = (baseName && baseName.split('/')),
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                trimDots(name);
                name = name.join('/');
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);

                //Custom require that does not do map translation, since
                //ID is "absolute", already mapped/resolved.
                context.makeRequire(null, {
                    skipMap: true
                })([id]);

                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        // If nested plugin references, then do not try to
                        // normalize, as it will not normalize correctly. This
                        // places a restriction on resourceIds, and the longer
                        // term solution is not to normalize until plugins are
                        // loaded and all normalizations to allow for async
                        // loading of a loader plugin. But for now, fixes the
                        // common uses. Details in #1131
                        normalizedName = name.indexOf('!') === -1 ?
                                         normalize(name, parentName, applyMap) :
                                         name;
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                each(globalDefQueue, function(queueItem) {
                    var id = queueItem[0];
                    if (typeof id === 'string') {
                        context.defQueueMap[id] = true;
                    }
                    defQueue.push(queueItem);
                });
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    // Only fetch if not already in the defQueue.
                    if (!hasProp(context.defQueueMap, id)) {
                        this.fetch();
                    }
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            if (this.undefed) {
                                return;
                            }
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        } else if (this.events.error) {
                            // No direct errback on this module, but something
                            // else is listening for errors, so be sure to
                            // propagate the error correctly.
                            on(depMap, 'error', bind(this, function(err) {
                                this.emit('error', err);
                            }));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' +
                        args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
            context.defQueueMap = {};
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            defQueueMap: {},
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? {name: pkgObj} : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id, null, true);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        mod.undefed = true;
                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if (args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });
                        delete context.defQueueMap[id];

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }
                context.defQueueMap = {};

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);
            if (config.onNodeCreated) {
                config.onNodeCreated(node, config, moduleName, url);
            }

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        if (context) {
            context.defQueue.push([name, deps, callback]);
            context.defQueueMap[name] = true;
        } else {
            globalDefQueue.push([name, deps, callback]);
        }
    };

    define.amd = {
        jQuery: true
    };

    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));

//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

/*!
 * jQuery JavaScript Library v2.1.4
 * http://jquery.com/
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 *
 * Copyright 2005, 2014 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2015-04-28T16:01Z
 */

/*!
 * Sizzle CSS Selector Engine v2.2.0-pre
 * http://sizzlejs.com/
 *
 * Copyright 2008, 2014 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2014-12-16
 */

//     (c) 2010-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

// Backbone.Wreqr (Backbone.Marionette)
// ----------------------------------
// v1.3.5
//
// Copyright (c)2015 Derick Bailey, Muted Solutions, LLC.
// Distributed under MIT license
//
// http://github.com/marionettejs/backbone.wreqr

// Backbone.BabySitter
// -------------------
// v0.1.10
//
// Copyright (c)2015 Derick Bailey, Muted Solutions, LLC.
// Distributed under MIT license
//
// http://github.com/marionettejs/backbone.babysitter

// MarionetteJS (Backbone.Marionette)
// ----------------------------------
// v2.4.3
//
// Copyright (c)2015 Derick Bailey, Muted Solutions, LLC.
// Distributed under MIT license
//
// http://marionettejs.com

//# sourceMappingURL=./backbone.radio.js.map;
// MIT License:
//
// Copyright (c) 2010-2013, Joe Walnes
//               2013-2014, Drew Noakes
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/**
 * Smoothie Charts - http://smoothiecharts.org/
 * (c) 2010-2013, Joe Walnes
 *     2013-2014, Drew Noakes
 *
 * v1.0: Main charting library, by Joe Walnes
 * v1.1: Auto scaling of axis, by Neil Dunn
 * v1.2: fps (frames per second) option, by Mathias Petterson
 * v1.3: Fix for divide by zero, by Paul Nikitochkin
 * v1.4: Set minimum, top-scale padding, remove timeseries, add optional timer to reset bounds, by Kelley Reynolds
 * v1.5: Set default frames per second to 50... smoother.
 *       .start(), .stop() methods for conserving CPU, by Dmitry Vyal
 *       options.interpolation = 'bezier' or 'line', by Dmitry Vyal
 *       options.maxValue to fix scale, by Dmitry Vyal
 * v1.6: minValue/maxValue will always get converted to floats, by Przemek Matylla
 * v1.7: options.grid.fillStyle may be a transparent color, by Dmitry A. Shashkin
 *       Smooth rescaling, by Kostas Michalopoulos
 * v1.8: Set max length to customize number of live points in the dataset with options.maxDataSetLength, by Krishna Narni
 * v1.9: Display timestamps along the bottom, by Nick and Stev-io
 *       (https://groups.google.com/forum/?fromgroups#!topic/smoothie-charts/-Ywse8FCpKI%5B1-25%5D)
 *       Refactored by Krishna Narni, to support timestamp formatting function
 * v1.10: Switch to requestAnimationFrame, removed the now obsoleted options.fps, by Gergely Imreh
 * v1.11: options.grid.sharpLines option added, by @drewnoakes
 *        Addressed warning seen in Firefox when seriesOption.fillStyle undefined, by @drewnoakes
 * v1.12: Support for horizontalLines added, by @drewnoakes
 *        Support for yRangeFunction callback added, by @drewnoakes
 * v1.13: Fixed typo (#32), by @alnikitich
 * v1.14: Timer cleared when last TimeSeries removed (#23), by @davidgaleano
 *        Fixed diagonal line on chart at start/end of data stream, by @drewnoakes
 * v1.15: Support for npm package (#18), by @dominictarr
 *        Fixed broken removeTimeSeries function (#24) by @davidgaleano
 *        Minor performance and tidying, by @drewnoakes
 * v1.16: Bug fix introduced in v1.14 relating to timer creation/clearance (#23), by @drewnoakes
 *        TimeSeries.append now deals with out-of-order timestamps, and can merge duplicates, by @zacwitte (#12)
 *        Documentation and some local variable renaming for clarity, by @drewnoakes
 * v1.17: Allow control over font size (#10), by @drewnoakes
 *        Timestamp text won't overlap, by @drewnoakes
 * v1.18: Allow control of max/min label precision, by @drewnoakes
 *        Added 'borderVisible' chart option, by @drewnoakes
 *        Allow drawing series with fill but no stroke (line), by @drewnoakes
 * v1.19: Avoid unnecessary repaints, and fixed flicker in old browsers having multiple charts in document (#40), by @asbai
 * v1.20: Add SmoothieChart.getTimeSeriesOptions and SmoothieChart.bringToFront functions, by @drewnoakes
 * v1.21: Add 'step' interpolation mode, by @drewnoakes
 * v1.22: Add support for different pixel ratios. Also add optional y limit formatters, by @copacetic
 * v1.23: Fix bug introduced in v1.22 (#44), by @drewnoakes
 * v1.24: Fix bug introduced in v1.23, re-adding parseFloat to y-axis formatter defaults, by @siggy_sf
 * v1.25: Fix bug seen when adding a data point to TimeSeries which is older than the current data, by @Nking92
 *        Draw time labels on top of series, by @comolosabia
 *        Add TimeSeries.clear function, by @drewnoakes
 * v1.26: Add support for resizing on high device pixel ratio screens, by @copacetic
 * v1.27: Fix bug introduced in v1.26 for non whole number devicePixelRatio values, by @zmbush
 */

/*!

 handlebars v3.0.3

Copyright (C) 2011-2014 by Yehuda Katz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@license
*/

(function(){(function(){function x(e){function t(t,n,r,i,s,o){for(;s>=0&&s<o;s+=e){var u=i?i[s]:s;r=n(r,t[u],u,t)}return r}return function(n,r,i,s){r=v(r,s,4);var o=!S(n)&&d.keys(n),u=(o||n).length,a=e>0?0:u-1;return arguments.length<3&&(i=n[o?o[a]:a],a+=e),t(n,r,i,o,a,u)}}function C(e){return function(t,n,r){n=m(n,r);var i=E(t),s=e>0?0:i-1;for(;s>=0&&s<i;s+=e)if(n(t[s],s,t))return s;return-1}}function k(e,t,n){return function(r,i,s){var u=0,a=E(r);if(typeof s=="number")e>0?u=s>=0?s:Math.max(s+a,u):a=s>=0?Math.min(s+1,a):s+a+1;else if(n&&s&&a)return s=n(r,i),r[s]===i?s:-1;if(i!==i)return s=t(o.call(r,u,a),d.isNaN),s>=0?s+u:-1;for(s=e>0?u:a-1;s>=0&&s<a;s+=e)if(r[s]===i)return s;return-1}}function M(e,t){var n=O.length,i=e.constructor,s=d.isFunction(i)&&i.prototype||r,o="constructor";d.has(e,o)&&!d.contains(t,o)&&t.push(o);while(n--)o=O[n],o in e&&e[o]!==s[o]&&!d.contains(t,o)&&t.push(o)}var e=this,t=e._,n=Array.prototype,r=Object.prototype,i=Function.prototype,s=n.push,o=n.slice,u=r.toString,a=r.hasOwnProperty,f=Array.isArray,l=Object.keys,c=i.bind,h=Object.create,p=function(){},d=function(e){if(e instanceof d)return e;if(!(this instanceof d))return new d(e);this._wrapped=e};typeof exports!="undefined"?(typeof module!="undefined"&&module.exports&&(exports=module.exports=d),exports._=d):e._=d,d.VERSION="1.8.3";var v=function(e,t,n){if(t===void 0)return e;switch(n==null?3:n){case 1:return function(n){return e.call(t,n)};case 2:return function(n,r){return e.call(t,n,r)};case 3:return function(n,r,i){return e.call(t,n,r,i)};case 4:return function(n,r,i,s){return e.call(t,n,r,i,s)}}return function(){return e.apply(t,arguments)}},m=function(e,t,n){return e==null?d.identity:d.isFunction(e)?v(e,t,n):d.isObject(e)?d.matcher(e):d.property(e)};d.iteratee=function(e,t){return m(e,t,Infinity)};var g=function(e,t){return function(n){var r=arguments.length;if(r<2||n==null)return n;for(var i=1;i<r;i++){var s=arguments[i],o=e(s),u=o.length;for(var a=0;a<u;a++){var f=o[a];if(!t||n[f]===void 0)n[f]=s[f]}}return n}},y=function(e){if(!d.isObject(e))return{};if(h)return h(e);p.prototype=e;var t=new p;return p.prototype=null,t},b=function(e){return function(t){return t==null?void 0:t[e]}},w=Math.pow(2,53)-1,E=b("length"),S=function(e){var t=E(e);return typeof t=="number"&&t>=0&&t<=w};d.each=d.forEach=function(e,t,n){t=v(t,n);var r,i;if(S(e))for(r=0,i=e.length;r<i;r++)t(e[r],r,e);else{var s=d.keys(e);for(r=0,i=s.length;r<i;r++)t(e[s[r]],s[r],e)}return e},d.map=d.collect=function(e,t,n){t=m(t,n);var r=!S(e)&&d.keys(e),i=(r||e).length,s=Array(i);for(var o=0;o<i;o++){var u=r?r[o]:o;s[o]=t(e[u],u,e)}return s},d.reduce=d.foldl=d.inject=x(1),d.reduceRight=d.foldr=x(-1),d.find=d.detect=function(e,t,n){var r;S(e)?r=d.findIndex(e,t,n):r=d.findKey(e,t,n);if(r!==void 0&&r!==-1)return e[r]},d.filter=d.select=function(e,t,n){var r=[];return t=m(t,n),d.each(e,function(e,n,i){t(e,n,i)&&r.push(e)}),r},d.reject=function(e,t,n){return d.filter(e,d.negate(m(t)),n)},d.every=d.all=function(e,t,n){t=m(t,n);var r=!S(e)&&d.keys(e),i=(r||e).length;for(var s=0;s<i;s++){var o=r?r[s]:s;if(!t(e[o],o,e))return!1}return!0},d.some=d.any=function(e,t,n){t=m(t,n);var r=!S(e)&&d.keys(e),i=(r||e).length;for(var s=0;s<i;s++){var o=r?r[s]:s;if(t(e[o],o,e))return!0}return!1},d.contains=d.includes=d.include=function(e,t,n,r){S(e)||(e=d.values(e));if(typeof n!="number"||r)n=0;return d.indexOf(e,t,n)>=0},d.invoke=function(e,t){var n=o.call(arguments,2),r=d.isFunction(t);return d.map(e,function(e){var i=r?t:e[t];return i==null?i:i.apply(e,n)})},d.pluck=function(e,t){return d.map(e,d.property(t))},d.where=function(e,t){return d.filter(e,d.matcher(t))},d.findWhere=function(e,t){return d.find(e,d.matcher(t))},d.max=function(e,t,n){var r=-Infinity,i=-Infinity,s,o;if(t==null&&e!=null){e=S(e)?e:d.values(e);for(var u=0,a=e.length;u<a;u++)s=e[u],s>r&&(r=s)}else t=m(t,n),d.each(e,function(e,n,s){o=t(e,n,s);if(o>i||o===-Infinity&&r===-Infinity)r=e,i=o});return r},d.min=function(e,t,n){var r=Infinity,i=Infinity,s,o;if(t==null&&e!=null){e=S(e)?e:d.values(e);for(var u=0,a=e.length;u<a;u++)s=e[u],s<r&&(r=s)}else t=m(t,n),d.each(e,function(e,n,s){o=t(e,n,s);if(o<i||o===Infinity&&r===Infinity)r=e,i=o});return r},d.shuffle=function(e){var t=S(e)?e:d.values(e),n=t.length,r=Array(n);for(var i=0,s;i<n;i++)s=d.random(0,i),s!==i&&(r[i]=r[s]),r[s]=t[i];return r},d.sample=function(e,t,n){return t==null||n?(S(e)||(e=d.values(e)),e[d.random(e.length-1)]):d.shuffle(e).slice(0,Math.max(0,t))},d.sortBy=function(e,t,n){return t=m(t,n),d.pluck(d.map(e,function(e,n,r){return{value:e,index:n,criteria:t(e,n,r)}}).sort(function(e,t){var n=e.criteria,r=t.criteria;if(n!==r){if(n>r||n===void 0)return 1;if(n<r||r===void 0)return-1}return e.index-t.index}),"value")};var T=function(e){return function(t,n,r){var i={};return n=m(n,r),d.each(t,function(r,s){var o=n(r,s,t);e(i,r,o)}),i}};d.groupBy=T(function(e,t,n){d.has(e,n)?e[n].push(t):e[n]=[t]}),d.indexBy=T(function(e,t,n){e[n]=t}),d.countBy=T(function(e,t,n){d.has(e,n)?e[n]++:e[n]=1}),d.toArray=function(e){return e?d.isArray(e)?o.call(e):S(e)?d.map(e,d.identity):d.values(e):[]},d.size=function(e){return e==null?0:S(e)?e.length:d.keys(e).length},d.partition=function(e,t,n){t=m(t,n);var r=[],i=[];return d.each(e,function(e,n,s){(t(e,n,s)?r:i).push(e)}),[r,i]},d.first=d.head=d.take=function(e,t,n){return e==null?void 0:t==null||n?e[0]:d.initial(e,e.length-t)},d.initial=function(e,t,n){return o.call(e,0,Math.max(0,e.length-(t==null||n?1:t)))},d.last=function(e,t,n){return e==null?void 0:t==null||n?e[e.length-1]:d.rest(e,Math.max(0,e.length-t))},d.rest=d.tail=d.drop=function(e,t,n){return o.call(e,t==null||n?1:t)},d.compact=function(e){return d.filter(e,d.identity)};var N=function(e,t,n,r){var i=[],s=0;for(var o=r||0,u=E(e);o<u;o++){var a=e[o];if(S(a)&&(d.isArray(a)||d.isArguments(a))){t||(a=N(a,t,n));var f=0,l=a.length;i.length+=l;while(f<l)i[s++]=a[f++]}else n||(i[s++]=a)}return i};d.flatten=function(e,t){return N(e,t,!1)},d.without=function(e){return d.difference(e,o.call(arguments,1))},d.uniq=d.unique=function(e,t,n,r){d.isBoolean(t)||(r=n,n=t,t=!1),n!=null&&(n=m(n,r));var i=[],s=[];for(var o=0,u=E(e);o<u;o++){var a=e[o],f=n?n(a,o,e):a;t?((!o||s!==f)&&i.push(a),s=f):n?d.contains(s,f)||(s.push(f),i.push(a)):d.contains(i,a)||i.push(a)}return i},d.union=function(){return d.uniq(N(arguments,!0,!0))},d.intersection=function(e){var t=[],n=arguments.length;for(var r=0,i=E(e);r<i;r++){var s=e[r];if(d.contains(t,s))continue;for(var o=1;o<n;o++)if(!d.contains(arguments[o],s))break;o===n&&t.push(s)}return t},d.difference=function(e){var t=N(arguments,!0,!0,1);return d.filter(e,function(e){return!d.contains(t,e)})},d.zip=function(){return d.unzip(arguments)},d.unzip=function(e){var t=e&&d.max(e,E).length||0,n=Array(t);for(var r=0;r<t;r++)n[r]=d.pluck(e,r);return n},d.object=function(e,t){var n={};for(var r=0,i=E(e);r<i;r++)t?n[e[r]]=t[r]:n[e[r][0]]=e[r][1];return n},d.findIndex=C(1),d.findLastIndex=C(-1),d.sortedIndex=function(e,t,n,r){n=m(n,r,1);var i=n(t),s=0,o=E(e);while(s<o){var u=Math.floor((s+o)/2);n(e[u])<i?s=u+1:o=u}return s},d.indexOf=k(1,d.findIndex,d.sortedIndex),d.lastIndexOf=k(-1,d.findLastIndex),d.range=function(e,t,n){t==null&&(t=e||0,e=0),n=n||1;var r=Math.max(Math.ceil((t-e)/n),0),i=Array(r);for(var s=0;s<r;s++,e+=n)i[s]=e;return i};var L=function(e,t,n,r,i){if(r instanceof t){var s=y(e.prototype),o=e.apply(s,i);return d.isObject(o)?o:s}return e.apply(n,i)};d.bind=function(e,t){if(c&&e.bind===c)return c.apply(e,o.call(arguments,1));if(!d.isFunction(e))throw new TypeError("Bind must be called on a function");var n=o.call(arguments,2),r=function(){return L(e,r,t,this,n.concat(o.call(arguments)))};return r},d.partial=function(e){var t=o.call(arguments,1),n=function(){var r=0,i=t.length,s=Array(i);for(var o=0;o<i;o++)s[o]=t[o]===d?arguments[r++]:t[o];while(r<arguments.length)s.push(arguments[r++]);return L(e,n,this,this,s)};return n},d.bindAll=function(e){var t,n=arguments.length,r;if(n<=1)throw new Error("bindAll must be passed function names");for(t=1;t<n;t++)r=arguments[t],e[r]=d.bind(e[r],e);return e},d.memoize=function(e,t){var n=function(r){var i=n.cache,s=""+(t?t.apply(this,arguments):r);return d.has(i,s)||(i[s]=e.apply(this,arguments)),i[s]};return n.cache={},n},d.delay=function(e,t){var n=o.call(arguments,2);return setTimeout(function(){return e.apply(null,n)},t)},d.defer=d.partial(d.delay,d,1),d.throttle=function(e,t,n){var r,i,s,o=null,u=0;n||(n={});var a=function(){u=n.leading===!1?0:d.now(),o=null,s=e.apply(r,i),o||(r=i=null)};return function(){var f=d.now();!u&&n.leading===!1&&(u=f);var l=t-(f-u);return r=this,i=arguments,l<=0||l>t?(o&&(clearTimeout(o),o=null),u=f,s=e.apply(r,i),o||(r=i=null)):!o&&n.trailing!==!1&&(o=setTimeout(a,l)),s}},d.debounce=function(e,t,n){var r,i,s,o,u,a=function(){var f=d.now()-o;f<t&&f>=0?r=setTimeout(a,t-f):(r=null,n||(u=e.apply(s,i),r||(s=i=null)))};return function(){s=this,i=arguments,o=d.now();var f=n&&!r;return r||(r=setTimeout(a,t)),f&&(u=e.apply(s,i),s=i=null),u}},d.wrap=function(e,t){return d.partial(t,e)},d.negate=function(e){return function(){return!e.apply(this,arguments)}},d.compose=function(){var e=arguments,t=e.length-1;return function(){var n=t,r=e[t].apply(this,arguments);while(n--)r=e[n].call(this,r);return r}},d.after=function(e,t){return function(){if(--e<1)return t.apply(this,arguments)}},d.before=function(e,t){var n;return function(){return--e>0&&(n=t.apply(this,arguments)),e<=1&&(t=null),n}},d.once=d.partial(d.before,2);var A=!{toString:null}.propertyIsEnumerable("toString"),O=["valueOf","isPrototypeOf","toString","propertyIsEnumerable","hasOwnProperty","toLocaleString"];d.keys=function(e){if(!d.isObject(e))return[];if(l)return l(e);var t=[];for(var n in e)d.has(e,n)&&t.push(n);return A&&M(e,t),t},d.allKeys=function(e){if(!d.isObject(e))return[];var t=[];for(var n in e)t.push(n);return A&&M(e,t),t},d.values=function(e){var t=d.keys(e),n=t.length,r=Array(n);for(var i=0;i<n;i++)r[i]=e[t[i]];return r},d.mapObject=function(e,t,n){t=m(t,n);var r=d.keys(e),i=r.length,s={},o;for(var u=0;u<i;u++)o=r[u],s[o]=t(e[o],o,e);return s},d.pairs=function(e){var t=d.keys(e),n=t.length,r=Array(n);for(var i=0;i<n;i++)r[i]=[t[i],e[t[i]]];return r},d.invert=function(e){var t={},n=d.keys(e);for(var r=0,i=n.length;r<i;r++)t[e[n[r]]]=n[r];return t},d.functions=d.methods=function(e){var t=[];for(var n in e)d.isFunction(e[n])&&t.push(n);return t.sort()},d.extend=g(d.allKeys),d.extendOwn=d.assign=g(d.keys),d.findKey=function(e,t,n){t=m(t,n);var r=d.keys(e),i;for(var s=0,o=r.length;s<o;s++){i=r[s];if(t(e[i],i,e))return i}},d.pick=function(e,t,n){var r={},i=e,s,o;if(i==null)return r;d.isFunction(t)?(o=d.allKeys(i),s=v(t,n)):(o=N(arguments,!1,!1,1),s=function(e,t,n){return t in n},i=Object(i));for(var u=0,a=o.length;u<a;u++){var f=o[u],l=i[f];s(l,f,i)&&(r[f]=l)}return r},d.omit=function(e,t,n){if(d.isFunction(t))t=d.negate(t);else{var r=d.map(N(arguments,!1,!1,1),String);t=function(e,t){return!d.contains(r,t)}}return d.pick(e,t,n)},d.defaults=g(d.allKeys,!0),d.create=function(e,t){var n=y(e);return t&&d.extendOwn(n,t),n},d.clone=function(e){return d.isObject(e)?d.isArray(e)?e.slice():d.extend({},e):e},d.tap=function(e,t){return t(e),e},d.isMatch=function(e,t){var n=d.keys(t),r=n.length;if(e==null)return!r;var i=Object(e);for(var s=0;s<r;s++){var o=n[s];if(t[o]!==i[o]||!(o in i))return!1}return!0};var _=function(e,t,n,r){if(e===t)return e!==0||1/e===1/t;if(e==null||t==null)return e===t;e instanceof d&&(e=e._wrapped),t instanceof d&&(t=t._wrapped);var i=u.call(e);if(i!==u.call(t))return!1;switch(i){case"[object RegExp]":case"[object String]":return""+e==""+t;case"[object Number]":if(+e!==+e)return+t!==+t;return+e===0?1/+e===1/t:+e===+t;case"[object Date]":case"[object Boolean]":return+e===+t}var s=i==="[object Array]";if(!s){if(typeof e!="object"||typeof t!="object")return!1;var o=e.constructor,a=t.constructor;if(o!==a&&!(d.isFunction(o)&&o instanceof o&&d.isFunction(a)&&a instanceof a)&&"constructor"in e&&"constructor"in t)return!1}n=n||[],r=r||[];var f=n.length;while(f--)if(n[f]===e)return r[f]===t;n.push(e),r.push(t);if(s){f=e.length;if(f!==t.length)return!1;while(f--)if(!_(e[f],t[f],n,r))return!1}else{var l=d.keys(e),c;f=l.length;if(d.keys(t).length!==f)return!1;while(f--){c=l[f];if(!d.has(t,c)||!_(e[c],t[c],n,r))return!1}}return n.pop(),r.pop(),!0};d.isEqual=function(e,t){return _(e,t)},d.isEmpty=function(e){return e==null?!0:S(e)&&(d.isArray(e)||d.isString(e)||d.isArguments(e))?e.length===0:d.keys(e).length===0},d.isElement=function(e){return!!e&&e.nodeType===1},d.isArray=f||function(e){return u.call(e)==="[object Array]"},d.isObject=function(e){var t=typeof e;return t==="function"||t==="object"&&!!e},d.each(["Arguments","Function","String","Number","Date","RegExp","Error"],function(e){d["is"+e]=function(t){return u.call(t)==="[object "+e+"]"}}),d.isArguments(arguments)||(d.isArguments=function(e){return d.has(e,"callee")}),typeof /./!="function"&&typeof Int8Array!="object"&&(d.isFunction=function(e){return typeof e=="function"||!1}),d.isFinite=function(e){return isFinite(e)&&!isNaN(parseFloat(e))},d.isNaN=function(e){return d.isNumber(e)&&e!==+e},d.isBoolean=function(e){return e===!0||e===!1||u.call(e)==="[object Boolean]"},d.isNull=function(e){return e===null},d.isUndefined=function(e){return e===void 0},d.has=function(e,t){return e!=null&&a.call(e,t)},d.noConflict=function(){return e._=t,this},d.identity=function(e){return e},d.constant=function(e){return function(){return e}},d.noop=function(){},d.property=b,d.propertyOf=function(e){return e==null?function(){}:function(t){return e[t]}},d.matcher=d.matches=function(e){return e=d.extendOwn({},e),function(t){return d.isMatch(t,e)}},d.times=function(e,t,n){var r=Array(Math.max(0,e));t=v(t,n,1);for(var i=0;i<e;i++)r[i]=t(i);return r},d.random=function(e,t){return t==null&&(t=e,e=0),e+Math.floor(Math.random()*(t-e+1))},d.now=Date.now||function(){return(new Date).getTime()};var D={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","`":"&#x60;"},P=d.invert(D),H=function(e){var t=function(t){return e[t]},n="(?:"+d.keys(e).join("|")+")",r=RegExp(n),i=RegExp(n,"g");return function(e){return e=e==null?"":""+e,r.test(e)?e.replace(i,t):e}};d.escape=H(D),d.unescape=H(P),d.result=function(e,t,n){var r=e==null?void 0:e[t];return r===void 0&&(r=n),d.isFunction(r)?r.call(e):r};var B=0;d.uniqueId=function(e){var t=++B+"";return e?e+t:t},d.templateSettings={evaluate:/<%([\s\S]+?)%>/g,interpolate:/<%=([\s\S]+?)%>/g,escape:/<%-([\s\S]+?)%>/g};var j=/(.)^/,F={"'":"'","\\":"\\","\r":"r","\n":"n","\u2028":"u2028","\u2029":"u2029"},I=/\\|'|\r|\n|\u2028|\u2029/g,q=function(e){return"\\"+F[e]};d.template=function(e,t,n){!t&&n&&(t=n),t=d.defaults({},t,d.templateSettings);var r=RegExp([(t.escape||j).source,(t.interpolate||j).source,(t.evaluate||j).source].join("|")+"|$","g"),i=0,s="__p+='";e.replace(r,function(t,n,r,o,u){return s+=e.slice(i,u).replace(I,q),i=u+t.length,n?s+="'+\n((__t=("+n+"))==null?'':_.escape(__t))+\n'":r?s+="'+\n((__t=("+r+"))==null?'':__t)+\n'":o&&(s+="';\n"+o+"\n__p+='"),t}),s+="';\n",t.variable||(s="with(obj||{}){\n"+s+"}\n"),s="var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};\n"+s+"return __p;\n";try{var o=new Function(t.variable||"obj","_",s)}catch(u){throw u.source=s,u}var a=function(e){return o.call(this,e,d)},f=t.variable||"obj";return a.source="function("+f+"){\n"+s+"}",a},d.chain=function(e){var t=d(e);return t._chain=!0,t};var R=function(e,t){return e._chain?d(t).chain():t};d.mixin=function(e){d.each(d.functions(e),function(t){var n=d[t]=e[t];d.prototype[t]=function(){var e=[this._wrapped];return s.apply(e,arguments),R(this,n.apply(d,e))}})},d.mixin(d),d.each(["pop","push","reverse","shift","sort","splice","unshift"],function(e){var t=n[e];d.prototype[e]=function(){var n=this._wrapped;return t.apply(n,arguments),(e==="shift"||e==="splice")&&n.length===0&&delete n[0],R(this,n)}}),d.each(["concat","join","slice"],function(e){var t=n[e];d.prototype[e]=function(){return R(this,t.apply(this._wrapped,arguments))}}),d.prototype.value=function(){return this._wrapped},d.prototype.valueOf=d.prototype.toJSON=d.prototype.value,d.prototype.toString=function(){return""+this._wrapped},typeof define=="function"&&define.amd&&define("underscore",[],function(){return d})}).call(this),function(e,t){typeof module=="object"&&typeof module.exports=="object"?module.exports=e.document?t(e,!0):function(e){if(!e.document)throw new Error("jQuery requires a window with a document");return t(e)}:t(e)}(typeof window!="undefined"?window:this,function(window,noGlobal){function isArraylike(e){var t="length"in e&&e.length,n=jQuery.type(e);return n==="function"||jQuery.isWindow(e)?!1:e.nodeType===1&&t?!0:n==="array"||t===0||typeof t=="number"&&t>0&&t-1 in e}function winnow(e,t,n){if(jQuery.isFunction(t))return jQuery.grep(e,function(e,r){return!!t.call(e,r,e)!==n});if(t.nodeType)return jQuery.grep(e,function(e){return e===t!==n});if(typeof t=="string"){if(risSimple.test(t))return jQuery.filter(t,e,n);t=jQuery.filter(t,e)}return jQuery.grep(e,function(e){return indexOf.call(t,e)>=0!==n})}function sibling(e,t){while((e=e[t])&&e.nodeType!==1);return e}function createOptions(e){var t=optionsCache[e]={};return jQuery.each(e.match(rnotwhite)||[],function(e,n){t[n]=!0}),t}function completed(){document.removeEventListener("DOMContentLoaded",completed,!1),window.removeEventListener("load",completed,!1),jQuery.ready()}function Data(){Object.defineProperty(this.cache={},0,{get:function(){return{}}}),this.expando=jQuery.expando+Data.uid++}function dataAttr(e,t,n){var r;if(n===undefined&&e.nodeType===1){r="data-"+t.replace(rmultiDash,"-$1").toLowerCase(),n=e.getAttribute(r);if(typeof n=="string"){try{n=n==="true"?!0:n==="false"?!1:n==="null"?null:+n+""===n?+n:rbrace.test(n)?jQuery.parseJSON(n):n}catch(i){}data_user.set(e,t,n)}else n=undefined}return n}function returnTrue(){return!0}function returnFalse(){return!1}function safeActiveElement(){try{return document.activeElement}catch(e){}}function manipulationTarget(e,t){return jQuery.nodeName(e,"table")&&jQuery.nodeName(t.nodeType!==11?t:t.firstChild,"tr")?e.getElementsByTagName("tbody")[0]||e.appendChild(e.ownerDocument.createElement("tbody")):e}function disableScript(e){return e.type=(e.getAttribute("type")!==null)+"/"+e.type,e}function restoreScript(e){var t=rscriptTypeMasked.exec(e.type);return t?e.type=t[1]:e.removeAttribute("type"),e}function setGlobalEval(e,t){var n=0,r=e.length;for(;n<r;n++)data_priv.set(e[n],"globalEval",!t||data_priv.get(t[n],"globalEval"))}function cloneCopyEvent(e,t){var n,r,i,s,o,u,a,f;if(t.nodeType!==1)return;if(data_priv.hasData(e)){s=data_priv.access(e),o=data_priv.set(t,s),f=s.events;if(f){delete o.handle,o.events={};for(i in f)for(n=0,r=f[i].length;n<r;n++)jQuery.event.add(t,i,f[i][n])}}data_user.hasData(e)&&(u=data_user.access(e),a=jQuery.extend({},u),data_user.set(t,a))}function getAll(e,t){var n=e.getElementsByTagName?e.getElementsByTagName(t||"*"):e.querySelectorAll?e.querySelectorAll(t||"*"):[];return t===undefined||t&&jQuery.nodeName(e,t)?jQuery.merge([e],n):n}function fixInput(e,t){var n=t.nodeName.toLowerCase();if(n==="input"&&rcheckableType.test(e.type))t.checked=e.checked;else if(n==="input"||n==="textarea")t.defaultValue=e.defaultValue}function actualDisplay(e,t){var n,r=jQuery(t.createElement(e)).appendTo(t.body),i=window.getDefaultComputedStyle&&(n=window.getDefaultComputedStyle(r[0]))?n.display:jQuery.css(r[0],"display");return r.detach(),i}function defaultDisplay(e){var t=document,n=elemdisplay[e];if(!n){n=actualDisplay(e,t);if(n==="none"||!n)iframe=(iframe||jQuery("<iframe frameborder='0' width='0' height='0'/>")).appendTo(t.documentElement),t=iframe[0].contentDocument,t.write(),t.close(),n=actualDisplay(e,t),iframe.detach();elemdisplay[e]=n}return n}function curCSS(e,t,n){var r,i,s,o,u=e.style;return n=n||getStyles(e),n&&(o=n.getPropertyValue(t)||n[t]),n&&(o===""&&!jQuery.contains(e.ownerDocument,e)&&(o=jQuery.style(e,t)),rnumnonpx.test(o)&&rmargin.test(t)&&(r=u.width,i=u.minWidth,s=u.maxWidth,u.minWidth=u.maxWidth=u.width=o,o=n.width,u.width=r,u.minWidth=i,u.maxWidth=s)),o!==undefined?o+"":o}function addGetHookIf(e,t){return{get:function(){if(e()){delete this.get;return}return(this.get=t).apply(this,arguments)}}}function vendorPropName(e,t){if(t in e)return t;var n=t[0].toUpperCase()+t.slice(1),r=t,i=cssPrefixes.length;while(i--){t=cssPrefixes[i]+n;if(t in e)return t}return r}function setPositiveNumber(e,t,n){var r=rnumsplit.exec(t);return r?Math.max(0,r[1]-(n||0))+(r[2]||"px"):t}function augmentWidthOrHeight(e,t,n,r,i){var s=n===(r?"border":"content")?4:t==="width"?1:0,o=0;for(;s<4;s+=2)n==="margin"&&(o+=jQuery.css(e,n+cssExpand[s],!0,i)),r?(n==="content"&&(o-=jQuery.css(e,"padding"+cssExpand[s],!0,i)),n!=="margin"&&(o-=jQuery.css(e,"border"+cssExpand[s]+"Width",!0,i))):(o+=jQuery.css(e,"padding"+cssExpand[s],!0,i),n!=="padding"&&(o+=jQuery.css(e,"border"+cssExpand[s]+"Width",!0,i)));return o}function getWidthOrHeight(e,t,n){var r=!0,i=t==="width"?e.offsetWidth:e.offsetHeight,s=getStyles(e),o=jQuery.css(e,"boxSizing",!1,s)==="border-box";if(i<=0||i==null){i=curCSS(e,t,s);if(i<0||i==null)i=e.style[t];if(rnumnonpx.test(i))return i;r=o&&(support.boxSizingReliable()||i===e.style[t]),i=parseFloat(i)||0}return i+augmentWidthOrHeight(e,t,n||(o?"border":"content"),r,s)+"px"}function showHide(e,t){var n,r,i,s=[],o=0,u=e.length;for(;o<u;o++){r=e[o];if(!r.style)continue;s[o]=data_priv.get(r,"olddisplay"),n=r.style.display,t?(!s[o]&&n==="none"&&(r.style.display=""),r.style.display===""&&isHidden(r)&&(s[o]=data_priv.access(r,"olddisplay",defaultDisplay(r.nodeName)))):(i=isHidden(r),(n!=="none"||!i)&&data_priv.set(r,"olddisplay",i?n:jQuery.css(r,"display")))}for(o=0;o<u;o++){r=e[o];if(!r.style)continue;if(!t||r.style.display==="none"||r.style.display==="")r.style.display=t?s[o]||"":"none"}return e}function Tween(e,t,n,r,i){return new Tween.prototype.init(e,t,n,r,i)}function createFxNow(){return setTimeout(function(){fxNow=undefined}),fxNow=jQuery.now()}function genFx(e,t){var n,r=0,i={height:e};t=t?1:0;for(;r<4;r+=2-t)n=cssExpand[r],i["margin"+n]=i["padding"+n]=e;return t&&(i.opacity=i.width=e),i}function createTween(e,t,n){var r,i=(tweeners[t]||[]).concat(tweeners["*"]),s=0,o=i.length;for(;s<o;s++)if(r=i[s].call(n,t,e))return r}function defaultPrefilter(e,t,n){var r,i,s,o,u,a,f,l,c=this,h={},p=e.style,d=e.nodeType&&isHidden(e),v=data_priv.get(e,"fxshow");n.queue||(u=jQuery._queueHooks(e,"fx"),u.unqueued==null&&(u.unqueued=0,a=u.empty.fire,u.empty.fire=function(){u.unqueued||a()}),u.unqueued++,c.always(function(){c.always(function(){u.unqueued--,jQuery.queue(e,"fx").length||u.empty.fire()})})),e.nodeType===1&&("height"in t||"width"in t)&&(n.overflow=[p.overflow,p.overflowX,p.overflowY],f=jQuery.css(e,"display"),l=f==="none"?data_priv.get(e,"olddisplay")||defaultDisplay(e.nodeName):f,l==="inline"&&jQuery.css(e,"float")==="none"&&(p.display="inline-block")),n.overflow&&(p.overflow="hidden",c.always(function(){p.overflow=n.overflow[0],p.overflowX=n.overflow[1],p.overflowY=n.overflow[2]}));for(r in t){i=t[r];if(rfxtypes.exec(i)){delete t[r],s=s||i==="toggle";if(i===(d?"hide":"show")){if(i!=="show"||!v||v[r]===undefined)continue;d=!0}h[r]=v&&v[r]||jQuery.style(e,r)}else f=undefined}if(!jQuery.isEmptyObject(h)){v?"hidden"in v&&(d=v.hidden):v=data_priv.access(e,"fxshow",{}),s&&(v.hidden=!d),d?jQuery(e).show():c.done(function(){jQuery(e).hide()}),c.done(function(){var t;data_priv.remove(e,"fxshow");for(t in h)jQuery.style(e,t,h[t])});for(r in h)o=createTween(d?v[r]:0,r,c),r in v||(v[r]=o.start,d&&(o.end=o.start,o.start=r==="width"||r==="height"?1:0))}else(f==="none"?defaultDisplay(e.nodeName):f)==="inline"&&(p.display=f)}function propFilter(e,t){var n,r,i,s,o;for(n in e){r=jQuery.camelCase(n),i=t[r],s=e[n],jQuery.isArray(s)&&(i=s[1],s=e[n]=s[0]),n!==r&&(e[r]=s,delete e[n]),o=jQuery.cssHooks[r];if(o&&"expand"in o){s=o.expand(s),delete e[r];for(n in s)n in e||(e[n]=s[n],t[n]=i)}else t[r]=i}}function Animation(e,t,n){var r,i,s=0,o=animationPrefilters.length,u=jQuery.Deferred().always(function(){delete a.elem}),a=function(){if(i)return!1;var t=fxNow||createFxNow(),n=Math.max(0,f.startTime+f.duration-t),r=n/f.duration||0,s=1-r,o=0,a=f.tweens.length;for(;o<a;o++)f.tweens[o].run(s);return u.notifyWith(e,[f,s,n]),s<1&&a?n:(u.resolveWith(e,[f]),!1)},f=u.promise({elem:e,props:jQuery.extend({},t),opts:jQuery.extend(!0,{specialEasing:{}},n),originalProperties:t,originalOptions:n,startTime:fxNow||createFxNow(),duration:n.duration,tweens:[],createTween:function(t,n){var r=jQuery.Tween(e,f.opts,t,n,f.opts.specialEasing[t]||f.opts.easing);return f.tweens.push(r),r},stop:function(t){var n=0,r=t?f.tweens.length:0;if(i)return this;i=!0;for(;n<r;n++)f.tweens[n].run(1);return t?u.resolveWith(e,[f,t]):u.rejectWith(e,[f,t]),this}}),l=f.props;propFilter(l,f.opts.specialEasing);for(;s<o;s++){r=animationPrefilters[s].call(f,e,l,f.opts);if(r)return r}return jQuery.map(l,createTween,f),jQuery.isFunction(f.opts.start)&&f.opts.start.call(e,f),jQuery.fx.timer(jQuery.extend(a,{elem:e,anim:f,queue:f.opts.queue})),f.progress(f.opts.progress).done(f.opts.done,f.opts.complete).fail(f.opts.fail).always(f.opts.always)}function addToPrefiltersOrTransports(e){return function(t,n){typeof t!="string"&&(n=t,t="*");var r,i=0,s=t.toLowerCase().match(rnotwhite)||[];if(jQuery.isFunction(n))while(r=s[i++])r[0]==="+"?(r=r.slice(1)||"*",(e[r]=e[r]||[]).unshift(n)):(e[r]=e[r]||[]).push(n)}}function inspectPrefiltersOrTransports(e,t,n,r){function o(u){var a;return i[u]=!0,jQuery.each(e[u]||[],function(e,u){var f=u(t,n,r);if(typeof f=="string"&&!s&&!i[f])return t.dataTypes.unshift(f),o(f),!1;if(s)return!(a=f)}),a}var i={},s=e===transports;return o(t.dataTypes[0])||!i["*"]&&o("*")}function ajaxExtend(e,t){var n,r,i=jQuery.ajaxSettings.flatOptions||{};for(n in t)t[n]!==undefined&&((i[n]?e:r||(r={}))[n]=t[n]);return r&&jQuery.extend(!0,e,r),e}function ajaxHandleResponses(e,t,n){var r,i,s,o,u=e.contents,a=e.dataTypes;while(a[0]==="*")a.shift(),r===undefined&&(r=e.mimeType||t.getResponseHeader("Content-Type"));if(r)for(i in u)if(u[i]&&u[i].test(r)){a.unshift(i);break}if(a[0]in n)s=a[0];else{for(i in n){if(!a[0]||e.converters[i+" "+a[0]]){s=i;break}o||(o=i)}s=s||o}if(s)return s!==a[0]&&a.unshift(s),n[s]}function ajaxConvert(e,t,n,r){var i,s,o,u,a,f={},l=e.dataTypes.slice();if(l[1])for(o in e.converters)f[o.toLowerCase()]=e.converters[o];s=l.shift();while(s){e.responseFields[s]&&(n[e.responseFields[s]]=t),!a&&r&&e.dataFilter&&(t=e.dataFilter(t,e.dataType)),a=s,s=l.shift();if(s)if(s==="*")s=a;else if(a!=="*"&&a!==s){o=f[a+" "+s]||f["* "+s];if(!o)for(i in f){u=i.split(" ");if(u[1]===s){o=f[a+" "+u[0]]||f["* "+u[0]];if(o){o===!0?o=f[i]:f[i]!==!0&&(s=u[0],l.unshift(u[1]));break}}}if(o!==!0)if(o&&e["throws"])t=o(t);else try{t=o(t)}catch(c){return{state:"parsererror",error:o?c:"No conversion from "+a+" to "+s}}}}return{state:"success",data:t}}function buildParams(e,t,n,r){var i;if(jQuery.isArray(t))jQuery.each(t,function(t,i){n||rbracket.test(e)?r(e,i):buildParams(e+"["+(typeof i=="object"?t:"")+"]",i,n,r)});else if(!n&&jQuery.type(t)==="object")for(i in t)buildParams(e+"["+i+"]",t[i],n,r);else r(e,t)}function getWindow(e){return jQuery.isWindow(e)?e:e.nodeType===9&&e.defaultView}var arr=[],slice=arr.slice,concat=arr.concat,push=arr.push,indexOf=arr.indexOf,class2type={},toString=class2type.toString,hasOwn=class2type.hasOwnProperty,support={},document=window.document,version="2.1.4",jQuery=function(e,t){return new jQuery.fn.init(e,t)},rtrim=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,rmsPrefix=/^-ms-/,rdashAlpha=/-([\da-z])/gi,fcamelCase=function(e,t){return t.toUpperCase()};jQuery.fn=jQuery.prototype={jquery:version,constructor:jQuery,selector:"",length:0,toArray:function(){return slice.call(this)},get:function(e){return e!=null?e<0?this[e+this.length]:this[e]:slice.call(this)},pushStack:function(e){var t=jQuery.merge(this.constructor(),e);return t.prevObject=this,t.context=this.context,t},each:function(e,t){return jQuery.each(this,e,t)},map:function(e){return this.pushStack(jQuery.map(this,function(t,n){return e.call(t,n,t)}))},slice:function(){return this.pushStack(slice.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(e){var t=this.length,n=+e+(e<0?t:0);return this.pushStack(n>=0&&n<t?[this[n]]:[])},end:function(){return this.prevObject||this.constructor(null)},push:push,sort:arr.sort,splice:arr.splice},jQuery.extend=jQuery.fn.extend=function(){var e,t,n,r,i,s,o=arguments[0]||{},u=1,a=arguments.length,f=!1;typeof o=="boolean"&&(f=o,o=arguments[u]||{},u++),typeof o!="object"&&!jQuery.isFunction(o)&&(o={}),u===a&&(o=this,u--);for(;u<a;u++)if((e=arguments[u])!=null)for(t in e){n=o[t],r=e[t];if(o===r)continue;f&&r&&(jQuery.isPlainObject(r)||(i=jQuery.isArray(r)))?(i?(i=!1,s=n&&jQuery.isArray(n)?n:[]):s=n&&jQuery.isPlainObject(n)?n:{},o[t]=jQuery.extend(f,s,r)):r!==undefined&&(o[t]=r)}return o},jQuery.extend({expando:"jQuery"+(version+Math.random()).replace(/\D/g,""),isReady:!0,error:function(e){throw new Error(e)},noop:function(){},isFunction:function(e){return jQuery.type(e)==="function"},isArray:Array.isArray,isWindow:function(e){return e!=null&&e===e.window},isNumeric:function(e){return!jQuery.isArray(e)&&e-parseFloat(e)+1>=0},isPlainObject:function(e){return jQuery.type(e)!=="object"||e.nodeType||jQuery.isWindow(e)?!1:e.constructor&&!hasOwn.call(e.constructor.prototype,"isPrototypeOf")?!1:!0},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},type:function(e){return e==null?e+"":typeof e=="object"||typeof e=="function"?class2type[toString.call(e)]||"object":typeof e},globalEval:function(code){var script,indirect=eval;code=jQuery.trim(code),code&&(code.indexOf("use strict")===1?(script=document.createElement("script"),script.text=code,document.head.appendChild(script).parentNode.removeChild(script)):indirect(code))},camelCase:function(e){return e.replace(rmsPrefix,"ms-").replace(rdashAlpha,fcamelCase)},nodeName:function(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()},each:function(e,t,n){var r,i=0,s=e.length,o=isArraylike(e);if(n)if(o)for(;i<s;i++){r=t.apply(e[i],n);if(r===!1)break}else for(i in e){r=t.apply(e[i],n);if(r===!1)break}else if(o)for(;i<s;i++){r=t.call(e[i],i,e[i]);if(r===!1)break}else for(i in e){r=t.call(e[i],i,e[i]);if(r===!1)break}return e},trim:function(e){return e==null?"":(e+"").replace(rtrim,"")},makeArray:function(e,t){var n=t||[];return e!=null&&(isArraylike(Object(e))?jQuery.merge(n,typeof e=="string"?[e]:e):push.call(n,e)),n},inArray:function(e,t,n){return t==null?-1:indexOf.call(t,e,n)},merge:function(e,t){var n=+t.length,r=0,i=e.length;for(;r<n;r++)e[i++]=t[r];return e.length=i,e},grep:function(e,t,n){var r,i=[],s=0,o=e.length,u=!n;for(;s<o;s++)r=!t(e[s],s),r!==u&&i.push(e[s]);return i},map:function(e,t,n){var r,i=0,s=e.length,o=isArraylike(e),u=[];if(o)for(;i<s;i++)r=t(e[i],i,n),r!=null&&u.push(r);else for(i in e)r=t(e[i],i,n),r!=null&&u.push(r);return concat.apply([],u)},guid:1,proxy:function(e,t){var n,r,i;return typeof t=="string"&&(n=e[t],t=e,e=n),jQuery.isFunction(e)?(r=slice.call(arguments,2),i=function(){return e.apply(t||this,r.concat(slice.call(arguments)))},i.guid=e.guid=e.guid||jQuery.guid++,i):undefined},now:Date.now,support:support}),jQuery.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(e,t){class2type["[object "+t+"]"]=t.toLowerCase()});var Sizzle=function(e){function ot(e,t,r,i){var s,u,f,l,c,d,g,y,S,x;(t?t.ownerDocument||t:E)!==p&&h(t),t=t||p,r=r||[],l=t.nodeType;if(typeof e!="string"||!e||l!==1&&l!==9&&l!==11)return r;if(!i&&v){if(l!==11&&(s=Z.exec(e)))if(f=s[1]){if(l===9){u=t.getElementById(f);if(!u||!u.parentNode)return r;if(u.id===f)return r.push(u),r}else if(t.ownerDocument&&(u=t.ownerDocument.getElementById(f))&&b(t,u)&&u.id===f)return r.push(u),r}else{if(s[2])return D.apply(r,t.getElementsByTagName(e)),r;if((f=s[3])&&n.getElementsByClassName)return D.apply(r,t.getElementsByClassName(f)),r}if(n.qsa&&(!m||!m.test(e))){y=g=w,S=t,x=l!==1&&e;if(l===1&&t.nodeName.toLowerCase()!=="object"){d=o(e),(g=t.getAttribute("id"))?y=g.replace(tt,"\\$&"):t.setAttribute("id",y),y="[id='"+y+"'] ",c=d.length;while(c--)d[c]=y+gt(d[c]);S=et.test(e)&&vt(t.parentNode)||t,x=d.join(",")}if(x)try{return D.apply(r,S.querySelectorAll(x)),r}catch(T){}finally{g||t.removeAttribute("id")}}}return a(e.replace(z,"$1"),t,r,i)}function ut(){function t(n,i){return e.push(n+" ")>r.cacheLength&&delete t[e.shift()],t[n+" "]=i}var e=[];return t}function at(e){return e[w]=!0,e}function ft(e){var t=p.createElement("div");try{return!!e(t)}catch(n){return!1}finally{t.parentNode&&t.parentNode.removeChild(t),t=null}}function lt(e,t){var n=e.split("|"),i=e.length;while(i--)r.attrHandle[n[i]]=t}function ct(e,t){var n=t&&e,r=n&&e.nodeType===1&&t.nodeType===1&&(~t.sourceIndex||L)-(~e.sourceIndex||L);if(r)return r;if(n)while(n=n.nextSibling)if(n===t)return-1;return e?1:-1}function ht(e){return function(t){var n=t.nodeName.toLowerCase();return n==="input"&&t.type===e}}function pt(e){return function(t){var n=t.nodeName.toLowerCase();return(n==="input"||n==="button")&&t.type===e}}function dt(e){return at(function(t){return t=+t,at(function(n,r){var i,s=e([],n.length,t),o=s.length;while(o--)n[i=s[o]]&&(n[i]=!(r[i]=n[i]))})})}function vt(e){return e&&typeof e.getElementsByTagName!="undefined"&&e}function mt(){}function gt(e){var t=0,n=e.length,r="";for(;t<n;t++)r+=e[t].value;return r}function yt(e,t,n){var r=t.dir,i=n&&r==="parentNode",s=x++;return t.first?function(t,n,s){while(t=t[r])if(t.nodeType===1||i)return e(t,n,s)}:function(t,n,o){var u,a,f=[S,s];if(o){while(t=t[r])if(t.nodeType===1||i)if(e(t,n,o))return!0}else while(t=t[r])if(t.nodeType===1||i){a=t[w]||(t[w]={});if((u=a[r])&&u[0]===S&&u[1]===s)return f[2]=u[2];a[r]=f;if(f[2]=e(t,n,o))return!0}}}function bt(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function wt(e,t,n){var r=0,i=t.length;for(;r<i;r++)ot(e,t[r],n);return n}function Et(e,t,n,r,i){var s,o=[],u=0,a=e.length,f=t!=null;for(;u<a;u++)if(s=e[u])if(!n||n(s,r,i))o.push(s),f&&t.push(u);return o}function St(e,t,n,r,i,s){return r&&!r[w]&&(r=St(r)),i&&!i[w]&&(i=St(i,s)),at(function(s,o,u,a){var f,l,c,h=[],p=[],d=o.length,v=s||wt(t||"*",u.nodeType?[u]:u,[]),m=e&&(s||!t)?Et(v,h,e,u,a):v,g=n?i||(s?e:d||r)?[]:o:m;n&&n(m,g,u,a);if(r){f=Et(g,p),r(f,[],u,a),l=f.length;while(l--)if(c=f[l])g[p[l]]=!(m[p[l]]=c)}if(s){if(i||e){if(i){f=[],l=g.length;while(l--)(c=g[l])&&f.push(m[l]=c);i(null,g=[],f,a)}l=g.length;while(l--)(c=g[l])&&(f=i?H(s,c):h[l])>-1&&(s[f]=!(o[f]=c))}}else g=Et(g===o?g.splice(d,g.length):g),i?i(null,o,g,a):D.apply(o,g)})}function xt(e){var t,n,i,s=e.length,o=r.relative[e[0].type],u=o||r.relative[" "],a=o?1:0,l=yt(function(e){return e===t},u,!0),c=yt(function(e){return H(t,e)>-1},u,!0),h=[function(e,n,r){var i=!o&&(r||n!==f)||((t=n).nodeType?l(e,n,r):c(e,n,r));return t=null,i}];for(;a<s;a++)if(n=r.relative[e[a].type])h=[yt(bt(h),n)];else{n=r.filter[e[a].type].apply(null,e[a].matches);if(n[w]){i=++a;for(;i<s;i++)if(r.relative[e[i].type])break;return St(a>1&&bt(h),a>1&&gt(e.slice(0,a-1).concat({value:e[a-2].type===" "?"*":""})).replace(z,"$1"),n,a<i&&xt(e.slice(a,i)),i<s&&xt(e=e.slice(i)),i<s&&gt(e))}h.push(n)}return bt(h)}function Tt(e,t){var n=t.length>0,i=e.length>0,s=function(s,o,u,a,l){var c,h,d,v=0,m="0",g=s&&[],y=[],b=f,w=s||i&&r.find.TAG("*",l),E=S+=b==null?1:Math.random()||.1,x=w.length;l&&(f=o!==p&&o);for(;m!==x&&(c=w[m])!=null;m++){if(i&&c){h=0;while(d=e[h++])if(d(c,o,u)){a.push(c);break}l&&(S=E)}n&&((c=!d&&c)&&v--,s&&g.push(c))}v+=m;if(n&&m!==v){h=0;while(d=t[h++])d(g,y,o,u);if(s){if(v>0)while(m--)!g[m]&&!y[m]&&(y[m]=M.call(a));y=Et(y)}D.apply(a,y),l&&!s&&y.length>0&&v+t.length>1&&ot.uniqueSort(a)}return l&&(S=E,f=b),g};return n?at(s):s}var t,n,r,i,s,o,u,a,f,l,c,h,p,d,v,m,g,y,b,w="sizzle"+1*new Date,E=e.document,S=0,x=0,T=ut(),N=ut(),C=ut(),k=function(e,t){return e===t&&(c=!0),0},L=1<<31,A={}.hasOwnProperty,O=[],M=O.pop,_=O.push,D=O.push,P=O.slice,H=function(e,t){var n=0,r=e.length;for(;n<r;n++)if(e[n]===t)return n;return-1},B="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",j="[\\x20\\t\\r\\n\\f]",F="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",I=F.replace("w","w#"),q="\\["+j+"*("+F+")(?:"+j+"*([*^$|!~]?=)"+j+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+I+"))|)"+j+"*\\]",R=":("+F+")(?:\\(("+"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|"+"((?:\\\\.|[^\\\\()[\\]]|"+q+")*)|"+".*"+")\\)|)",U=new RegExp(j+"+","g"),z=new RegExp("^"+j+"+|((?:^|[^\\\\])(?:\\\\.)*)"+j+"+$","g"),W=new RegExp("^"+j+"*,"+j+"*"),X=new RegExp("^"+j+"*([>+~]|"+j+")"+j+"*"),V=new RegExp("="+j+"*([^\\]'\"]*?)"+j+"*\\]","g"),$=new RegExp(R),J=new RegExp("^"+I+"$"),K={ID:new RegExp("^#("+F+")"),CLASS:new RegExp("^\\.("+F+")"),TAG:new RegExp("^("+F.replace("w","w*")+")"),ATTR:new RegExp("^"+q),PSEUDO:new RegExp("^"+R),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+j+"*(even|odd|(([+-]|)(\\d*)n|)"+j+"*(?:([+-]|)"+j+"*(\\d+)|))"+j+"*\\)|)","i"),bool:new RegExp("^(?:"+B+")$","i"),needsContext:new RegExp("^"+j+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+j+"*((?:-\\d)?\\d*)"+j+"*\\)|)(?=[^-]|$)","i")},Q=/^(?:input|select|textarea|button)$/i,G=/^h\d$/i,Y=/^[^{]+\{\s*\[native \w/,Z=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,et=/[+~]/,tt=/'|\\/g,nt=new RegExp("\\\\([\\da-f]{1,6}"+j+"?|("+j+")|.)","ig"),rt=function(e,t,n){var r="0x"+t-65536;return r!==r||n?t:r<0?String.fromCharCode(r+65536):String.fromCharCode(r>>10|55296,r&1023|56320)},it=function(){h()};try{D.apply(O=P.call(E.childNodes),E.childNodes),O[E.childNodes.length].nodeType}catch(st){D={apply:O.length?function(e,t){_.apply(e,P.call(t))}:function(e,t){var n=e.length,r=0;while(e[n++]=t[r++]);e.length=n-1}}}n=ot.support={},s=ot.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return t?t.nodeName!=="HTML":!1},h=ot.setDocument=function(e){var t,i,o=e?e.ownerDocument||e:E;if(o===p||o.nodeType!==9||!o.documentElement)return p;p=o,d=o.documentElement,i=o.defaultView,i&&i!==i.top&&(i.addEventListener?i.addEventListener("unload",it,!1):i.attachEvent&&i.attachEvent("onunload",it)),v=!s(o),n.attributes=ft(function(e){return e.className="i",!e.getAttribute("className")}),n.getElementsByTagName=ft(function(e){return e.appendChild(o.createComment("")),!e.getElementsByTagName("*").length}),n.getElementsByClassName=Y.test(o.getElementsByClassName),n.getById=ft(function(e){return d.appendChild(e).id=w,!o.getElementsByName||!o.getElementsByName(w).length}),n.getById?(r.find.ID=function(e,t){if(typeof t.getElementById!="undefined"&&v){var n=t.getElementById(e);return n&&n.parentNode?[n]:[]}},r.filter.ID=function(e){var t=e.replace(nt,rt);return function(e){return e.getAttribute("id")===t}}):(delete r.find.ID,r.filter.ID=function(e){var t=e.replace(nt,rt);return function(e){var n=typeof e.getAttributeNode!="undefined"&&e.getAttributeNode("id");return n&&n.value===t}}),r.find.TAG=n.getElementsByTagName?function(e,t){if(typeof t.getElementsByTagName!="undefined")return t.getElementsByTagName(e);if(n.qsa)return t.querySelectorAll(e)}:function(e,t){var n,r=[],i=0,s=t.getElementsByTagName(e);if(e==="*"){while(n=s[i++])n.nodeType===1&&r.push(n);return r}return s},r.find.CLASS=n.getElementsByClassName&&function(e,t){if(v)return t.getElementsByClassName(e)},g=[],m=[];if(n.qsa=Y.test(o.querySelectorAll))ft(function(e){d.appendChild(e).innerHTML="<a id='"+w+"'></a>"+"<select id='"+w+"-\f]' msallowcapture=''>"+"<option selected=''></option></select>",e.querySelectorAll("[msallowcapture^='']").length&&m.push("[*^$]="+j+"*(?:''|\"\")"),e.querySelectorAll("[selected]").length||m.push("\\["+j+"*(?:value|"+B+")"),e.querySelectorAll("[id~="+w+"-]").length||m.push("~="),e.querySelectorAll(":checked").length||m.push(":checked"),e.querySelectorAll("a#"+w+"+*").length||m.push(".#.+[+~]")}),ft(function(e){var t=o.createElement("input");t.setAttribute("type","hidden"),e.appendChild(t).setAttribute("name","D"),e.querySelectorAll("[name=d]").length&&m.push("name"+j+"*[*^$|!~]?="),e.querySelectorAll(":enabled").length||m.push(":enabled",":disabled"),e.querySelectorAll("*,:x"),m.push(",.*:")});return(n.matchesSelector=Y.test(y=d.matches||d.webkitMatchesSelector||d.mozMatchesSelector||d.oMatchesSelector||d.msMatchesSelector))&&ft(function(e){n.disconnectedMatch=y.call(e,"div"),y.call(e,"[s!='']:x"),g.push("!=",R)}),m=m.length&&new RegExp(m.join("|")),g=g.length&&new RegExp(g.join("|")),t=Y.test(d.compareDocumentPosition),b=t||Y.test(d.contains)?function(e,t){var n=e.nodeType===9?e.documentElement:e,r=t&&t.parentNode;return e===r||!!r&&r.nodeType===1&&!!(n.contains?n.contains(r):e.compareDocumentPosition&&e.compareDocumentPosition(r)&16)}:function(e,t){if(t)while(t=t.parentNode)if(t===e)return!0;return!1},k=t?function(e,t){if(e===t)return c=!0,0;var r=!e.compareDocumentPosition-!t.compareDocumentPosition;return r?r:(r=(e.ownerDocument||e)===(t.ownerDocument||t)?e.compareDocumentPosition(t):1,r&1||!n.sortDetached&&t.compareDocumentPosition(e)===r?e===o||e.ownerDocument===E&&b(E,e)?-1:t===o||t.ownerDocument===E&&b(E,t)?1:l?H(l,e)-H(l,t):0:r&4?-1:1)}:function(e,t){if(e===t)return c=!0,0;var n,r=0,i=e.parentNode,s=t.parentNode,u=[e],a=[t];if(!i||!s)return e===o?-1:t===o?1:i?-1:s?1:l?H(l,e)-H(l,t):0;if(i===s)return ct(e,t);n=e;while(n=n.parentNode)u.unshift(n);n=t;while(n=n.parentNode)a.unshift(n);while(u[r]===a[r])r++;return r?ct(u[r],a[r]):u[r]===E?-1:a[r]===E?1:0},o},ot.matches=function(e,t){return ot(e,null,null,t)},ot.matchesSelector=function(e,t){(e.ownerDocument||e)!==p&&h(e),t=t.replace(V,"='$1']");if(n.matchesSelector&&v&&(!g||!g.test(t))&&(!m||!m.test(t)))try{var r=y.call(e,t);if(r||n.disconnectedMatch||e.document&&e.document.nodeType!==11)return r}catch(i){}return ot(t,p,null,[e]).length>0},ot.contains=function(e,t){return(e.ownerDocument||e)!==p&&h(e),b(e,t)},ot.attr=function(e,t){(e.ownerDocument||e)!==p&&h(e);var i=r.attrHandle[t.toLowerCase()],s=i&&A.call(r.attrHandle,t.toLowerCase())?i(e,t,!v):undefined;return s!==undefined?s:n.attributes||!v?e.getAttribute(t):(s=e.getAttributeNode(t))&&s.specified?s.value:null},ot.error=function(e){throw new Error("Syntax error, unrecognized expression: "+e)},ot.uniqueSort=function(e){var t,r=[],i=0,s=0;c=!n.detectDuplicates,l=!n.sortStable&&e.slice(0),e.sort(k);if(c){while(t=e[s++])t===e[s]&&(i=r.push(s));while(i--)e.splice(r[i],1)}return l=null,e},i=ot.getText=function(e){var t,n="",r=0,s=e.nodeType;if(!s)while(t=e[r++])n+=i(t);else if(s===1||s===9||s===11){if(typeof e.textContent=="string")return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=i(e)}else if(s===3||s===4)return e.nodeValue;return n},r=ot.selectors={cacheLength:50,createPseudo:at,match:K,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace(nt,rt),e[3]=(e[3]||e[4]||e[5]||"").replace(nt,rt),e[2]==="~="&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),e[1].slice(0,3)==="nth"?(e[3]||ot.error(e[0]),e[4]=+(e[4]?e[5]+(e[6]||1):2*(e[3]==="even"||e[3]==="odd")),e[5]=+(e[7]+e[8]||e[3]==="odd")):e[3]&&ot.error(e[0]),e},PSEUDO:function(e){var t,n=!e[6]&&e[2];return K.CHILD.test(e[0])?null:(e[3]?e[2]=e[4]||e[5]||"":n&&$.test(n)&&(t=o(n,!0))&&(t=n.indexOf(")",n.length-t)-n.length)&&(e[0]=e[0].slice(0,t),e[2]=n.slice(0,t)),e.slice(0,3))}},filter:{TAG:function(e){var t=e.replace(nt,rt).toLowerCase();return e==="*"?function(){return!0}:function(e){return e.nodeName&&e.nodeName.toLowerCase()===t}},CLASS:function(e){var t=T[e+" "];return t||(t=new RegExp("(^|"+j+")"+e+"("+j+"|$)"))&&T(e,function(e){return t.test(typeof e.className=="string"&&e.className||typeof e.getAttribute!="undefined"&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r){var i=ot.attr(r,e);return i==null?t==="!=":t?(i+="",t==="="?i===n:t==="!="?i!==n:t==="^="?n&&i.indexOf(n)===0:t==="*="?n&&i.indexOf(n)>-1:t==="$="?n&&i.slice(-n.length)===n:t==="~="?(" "+i.replace(U," ")+" ").indexOf(n)>-1:t==="|="?i===n||i.slice(0,n.length+1)===n+"-":!1):!0}},CHILD:function(e,t,n,r,i){var s=e.slice(0,3)!=="nth",o=e.slice(-4)!=="last",u=t==="of-type";return r===1&&i===0?function(e){return!!e.parentNode}:function(t,n,a){var f,l,c,h,p,d,v=s!==o?"nextSibling":"previousSibling",m=t.parentNode,g=u&&t.nodeName.toLowerCase(),y=!a&&!u;if(m){if(s){while(v){c=t;while(c=c[v])if(u?c.nodeName.toLowerCase()===g:c.nodeType===1)return!1;d=v=e==="only"&&!d&&"nextSibling"}return!0}d=[o?m.firstChild:m.lastChild];if(o&&y){l=m[w]||(m[w]={}),f=l[e]||[],p=f[0]===S&&f[1],h=f[0]===S&&f[2],c=p&&m.childNodes[p];while(c=++p&&c&&c[v]||(h=p=0)||d.pop())if(c.nodeType===1&&++h&&c===t){l[e]=[S,p,h];break}}else if(y&&(f=(t[w]||(t[w]={}))[e])&&f[0]===S)h=f[1];else while(c=++p&&c&&c[v]||(h=p=0)||d.pop())if((u?c.nodeName.toLowerCase()===g:c.nodeType===1)&&++h){y&&((c[w]||(c[w]={}))[e]=[S,h]);if(c===t)break}return h-=i,h===r||h%r===0&&h/r>=0}}},PSEUDO:function(e,t){var n,i=r.pseudos[e]||r.setFilters[e.toLowerCase()]||ot.error("unsupported pseudo: "+e);return i[w]?i(t):i.length>1?(n=[e,e,"",t],r.setFilters.hasOwnProperty(e.toLowerCase())?at(function(e,n){var r,s=i(e,t),o=s.length;while(o--)r=H(e,s[o]),e[r]=!(n[r]=s[o])}):function(e){return i(e,0,n)}):i}},pseudos:{not:at(function(e){var t=[],n=[],r=u(e.replace(z,"$1"));return r[w]?at(function(e,t,n,i){var s,o=r(e,null,i,[]),u=e.length;while(u--)if(s=o[u])e[u]=!(t[u]=s)}):function(e,i,s){return t[0]=e,r(t,null,s,n),t[0]=null,!n.pop()}}),has:at(function(e){return function(t){return ot(e,t).length>0}}),contains:at(function(e){return e=e.replace(nt,rt),function(t){return(t.textContent||t.innerText||i(t)).indexOf(e)>-1}}),lang:at(function(e){return J.test(e||"")||ot.error("unsupported lang: "+e),e=e.replace(nt,rt).toLowerCase(),function(t){var n;do if(n=v?t.lang:t.getAttribute("xml:lang")||t.getAttribute("lang"))return n=n.toLowerCase(),n===e||n.indexOf(e+"-")===0;while((t=t.parentNode)&&t.nodeType===1);return!1}}),target:function(t){var n=e.location&&e.location.hash;return n&&n.slice(1)===t.id},root:function(e){return e===d},focus:function(e){return e===p.activeElement&&(!p.hasFocus||p.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},enabled:function(e){return e.disabled===!1},disabled:function(e){return e.disabled===!0},checked:function(e){var t=e.nodeName.toLowerCase();return t==="input"&&!!e.checked||t==="option"&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,e.selected===!0},empty:function(e){for(e=e.firstChild;e;e=e.nextSibling)if(e.nodeType<6)return!1;return!0},parent:function(e){return!r.pseudos.empty(e)},header:function(e){return G.test(e.nodeName)},input:function(e){return Q.test(e.nodeName)},button:function(e){var t=e.nodeName.toLowerCase();return t==="input"&&e.type==="button"||t==="button"},text:function(e){var t;return e.nodeName.toLowerCase()==="input"&&e.type==="text"&&((t=e.getAttribute("type"))==null||t.toLowerCase()==="text")},first:dt(function(){return[0]}),last:dt(function(e,t){return[t-1]}),eq:dt(function(e,t,n){return[n<0?n+t:n]}),even:dt(function(e,t){var n=0;for(;n<t;n+=2)e.push(n);return e}),odd:dt(function(e,t){var n=1;for(;n<t;n+=2)e.push(n);return e}),lt:dt(function(e,t,n){var r=n<0?n+t:n;for(;--r>=0;)e.push(r);return e}),gt:dt(function(e,t,n){var r=n<0?n+t:n;for(;++r<t;)e.push(r);return e})}},r.pseudos.nth=r.pseudos.eq;for(t in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})r.pseudos[t]=ht(t);for(t in{submit:!0,reset:!0})r.pseudos[t]=pt(t);return mt.prototype=r.filters=r.pseudos,r.setFilters=new mt,o=ot.tokenize=function(e,t){var n,i,s,o,u,a,f,l=N[e+" "];if(l)return t?0:l.slice(0);u=e,a=[],f=r.preFilter;while(u){if(!n||(i=W.exec(u)))i&&(u=u.slice(i[0].length)||u),a.push(s=[]);n=!1;if(i=X.exec(u))n=i.shift(),s.push({value:n,type:i[0].replace(z," ")}),u=u.slice(n.length);for(o in r.filter)(i=K[o].exec(u))&&(!f[o]||(i=f[o](i)))&&(n=i.shift(),s.push({value:n,type:o,matches:i}),u=u.slice(n.length));if(!n)break}return t?u.length:u?ot.error(e):N(e,a).slice(0)},u=ot.compile=function(e,t){var n,r=[],i=[],s=C[e+" "];if(!s){t||(t=o(e)),n=t.length;while(n--)s=xt(t[n]),s[w]?r.push(s):i.push(s);s=C(e,Tt(i,r)),s.selector=e}return s},a=ot.select=function(e,t,i,s){var a,f,l,c,h,p=typeof e=="function"&&e,d=!s&&o(e=p.selector||e);i=i||[];if(d.length===1){f=d[0]=d[0].slice(0);if(f.length>2&&(l=f[0]).type==="ID"&&n.getById&&t.nodeType===9&&v&&r.relative[f[1].type]){t=(r.find.ID(l.matches[0].replace(nt,rt),t)||[])[0];if(!t)return i;p&&(t=t.parentNode),e=e.slice(f.shift().value.length)}a=K.needsContext.test(e)?0:f.length;while(a--){l=f[a];if(r.relative[c=l.type])break;if(h=r.find[c])if(s=h(l.matches[0].replace(nt,rt),et.test(f[0].type)&&vt(t.parentNode)||t)){f.splice(a,1),e=s.length&&gt(f);if(!e)return D.apply(i,s),i;break}}}return(p||u(e,d))(s,t,!v,i,et.test(e)&&vt(t.parentNode)||t),i},n.sortStable=w.split("").sort(k).join("")===w,n.detectDuplicates=!!c,h(),n.sortDetached=ft(function(e){return e.compareDocumentPosition(p.createElement("div"))&1}),ft(function(e){return e.innerHTML="<a href='#'></a>",e.firstChild.getAttribute("href")==="#"})||lt("type|href|height|width",function(e,t,n){if(!n)return e.getAttribute(t,t.toLowerCase()==="type"?1:2)}),(!n.attributes||!ft(function(e){return e.innerHTML="<input/>",e.firstChild.setAttribute("value",""),e.firstChild.getAttribute("value")===""}))&&lt("value",function(e,t,n){if(!n&&e.nodeName.toLowerCase()==="input")return e.defaultValue}),ft(function(e){return e.getAttribute("disabled")==null})||lt(B,function(e,t,n){var r;if(!n)return e[t]===!0?t.toLowerCase():(r=e.getAttributeNode(t))&&r.specified?r.value:null}),ot}(window);jQuery.find=Sizzle,jQuery.expr=Sizzle.selectors,jQuery.expr[":"]=jQuery.expr.pseudos,jQuery.unique=Sizzle.uniqueSort,jQuery.text=Sizzle.getText,jQuery.isXMLDoc=Sizzle.isXML,jQuery.contains=Sizzle.contains;var rneedsContext=jQuery.expr.match.needsContext,rsingleTag=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,risSimple=/^.[^:#\[\.,]*$/;jQuery.filter=function(e,t,n){var r=t[0];return n&&(e=":not("+e+")"),t.length===1&&r.nodeType===1?jQuery.find.matchesSelector(r,e)?[r]:[]:jQuery.find.matches(e,jQuery.grep(t,function(e){return e.nodeType===1}))},jQuery.fn.extend({find:function(e){var t,n=this.length,r=[],i=this;if(typeof e!="string")return this.pushStack(jQuery(e).filter(function(){for(t=0;t<n;t++)if(jQuery.contains(i[t],this))return!0}));for(t=0;t<n;t++)jQuery.find(e,i[t],r);return r=this.pushStack(n>1?jQuery.unique(r):r),r.selector=this.selector?this.selector+" "+e:e,r},filter:function(e){return this.pushStack(winnow(this,e||[],!1))},not:function(e){return this.pushStack(winnow(this,e||[],!0))},is:function(e){return!!winnow(this,typeof e=="string"&&rneedsContext.test(e)?jQuery(e):e||[],!1).length}});var rootjQuery,rquickExpr=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,init=jQuery.fn.init=function(e,t){var n,r;if(!e)return this;if(typeof e=="string"){e[0]==="<"&&e[e.length-1]===">"&&e.length>=3?n=[null,e,null]:n=rquickExpr.exec(e);if(n&&(n[1]||!t)){if(n[1]){t=t instanceof jQuery?t[0]:t,jQuery.merge(this,jQuery.parseHTML(n[1],t&&t.nodeType?t.ownerDocument||t:document,!0));if(rsingleTag.test(n[1])&&jQuery.isPlainObject(t))for(n in t)jQuery.isFunction(this[n])?this[n](t[n]):this.attr(n,t[n]);return this}return r=document.getElementById(n[2]),r&&r.parentNode&&(this.length=1,this[0]=r),this.context=document,this.selector=e,this}return!t||t.jquery?(t||rootjQuery).find(e):this.constructor(t).find(e)}return e.nodeType?(this.context=this[0]=e,this.length=1,this):jQuery.isFunction(e)?typeof rootjQuery.ready!="undefined"?rootjQuery.ready(e):e(jQuery):(e.selector!==undefined&&(this.selector=e.selector,this.context=e.context),jQuery.makeArray(e,this))};init.prototype=jQuery.fn,rootjQuery=jQuery(document);var rparentsprev=/^(?:parents|prev(?:Until|All))/,guaranteedUnique={children:!0,contents:!0,next:!0,prev:!0};jQuery.extend({dir:function(e,t,n){var r=[],i=n!==undefined;while((e=e[t])&&e.nodeType!==9)if(e.nodeType===1){if(i&&jQuery(e).is(n))break;r.push(e)}return r},sibling:function(e,t){var n=[];for(;e;e=e.nextSibling)e.nodeType===1&&e!==t&&n.push(e);return n}}),jQuery.fn.extend({has:function(e){var t=jQuery(e,this),n=t.length;return this.filter(function(){var e=0;for(;e<n;e++)if(jQuery.contains(this,t[e]))return!0})},closest:function(e,t){var n,r=0,i=this.length,s=[],o=rneedsContext.test(e)||typeof e!="string"?jQuery(e,t||this.context):0;for(;r<i;r++)for(n=this[r];n&&n!==t;n=n.parentNode)if(n.nodeType<11&&(o?o.index(n)>-1:n.nodeType===1&&jQuery.find.matchesSelector(n,e))){s.push(n);break}return this.pushStack(s.length>1?jQuery.unique(s):s)},index:function(e){return e?typeof e=="string"?indexOf.call(jQuery(e),this[0]):indexOf.call(this,e.jquery?e[0]:e):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(e,t){return this.pushStack(jQuery.unique(jQuery.merge(this.get(),jQuery(e,t))))},addBack:function(e){return this.add(e==null?this.prevObject:this.prevObject.filter(e))}}),jQuery.each({parent:function(e){var t=e.parentNode;return t&&t.nodeType!==11?t:null},parents:function(e){return jQuery.dir(e,"parentNode")},parentsUntil:function(e,t,n){return jQuery.dir(e,"parentNode",n)},next:function(e){return sibling(e,"nextSibling")},prev:function(e){return sibling(e,"previousSibling")},nextAll:function(e){return jQuery.dir(e,"nextSibling")},prevAll:function(e){return jQuery.dir(e,"previousSibling")},nextUntil:function(e,t,n){return jQuery.dir(e,"nextSibling",n)},prevUntil:function(e,t,n){return jQuery.dir(e,"previousSibling",n)},siblings:function(e){return jQuery.sibling((e.parentNode||{}).firstChild,e)},children:function(e){return jQuery.sibling(e.firstChild)},contents:function(e){return e.contentDocument||jQuery.merge([],e.childNodes)}},function(e,t){jQuery.fn[e]=function(n,r){var i=jQuery.map(this,t,n);return e.slice(-5)!=="Until"&&(r=n),r&&typeof r=="string"&&(i=jQuery.filter(r,i)),this.length>1&&(guaranteedUnique[e]||jQuery.unique(i),rparentsprev.test(e)&&i.reverse()),this.pushStack(i)}});var rnotwhite=/\S+/g,optionsCache={};jQuery.Callbacks=function(e){e=typeof e=="string"?optionsCache[e]||createOptions(e):jQuery.extend({},e);var t,n,r,i,s,o,u=[],a=!e.once&&[],f=function(c){t=e.memory&&c,n=!0,o=i||0,i=0,s=u.length,r=!0;for(;u&&o<s;o++)if(u[o].apply(c[0],c[1])===!1&&e.stopOnFalse){t=!1;break}r=!1,u&&(a?a.length&&f(a.shift()):t?u=[]:l.disable())},l={add:function(){if(u){var n=u.length;(function o(t){jQuery.each(t,function(t,n){var r=jQuery.type(n);r==="function"?(!e.unique||!l.has(n))&&u.push(n):n&&n.length&&r!=="string"&&o(n)})})(arguments),r?s=u.length:t&&(i=n,f(t))}return this},remove:function(){return u&&jQuery.each(arguments,function(e,t){var n;while((n=jQuery.inArray(t,u,n))>-1)u.splice(n,1),r&&(n<=s&&s--,n<=o&&o--)}),this},has:function(e){return e?jQuery.inArray(e,u)>-1:!!u&&!!u.length},empty:function(){return u=[],s=0,this},disable:function(){return u=a=t=undefined,this},disabled:function(){return!u},lock:function(){return a=undefined,t||l.disable(),this},locked:function(){return!a},fireWith:function(e,t){return u&&(!n||a)&&(t=t||[],t=[e,t.slice?t.slice():t],r?a.push(t):f(t)),this},fire:function(){return l.fireWith(this,arguments),this},fired:function(){return!!n}};return l},jQuery.extend({Deferred:function(e){var t=[["resolve","done",jQuery.Callbacks("once memory"),"resolved"],["reject","fail",jQuery.Callbacks("once memory"),"rejected"],["notify","progress",jQuery.Callbacks("memory")]],n="pending",r={state:function(){return n},always:function(){return i.done(arguments).fail(arguments),this},then:function(){var e=arguments;return jQuery.Deferred(function(n){jQuery.each(t,function(t,s){var o=jQuery.isFunction(e[t])&&e[t];i[s[1]](function(){var e=o&&o.apply(this,arguments);e&&jQuery.isFunction(e.promise)?e.promise().done(n.resolve).fail(n.reject).progress(n.notify):n[s[0]+"With"](this===r?n.promise():this,o?[e]:arguments)})}),e=null}).promise()},promise:function(e){return e!=null?jQuery.extend(e,r):r}},i={};return r.pipe=r.then,jQuery.each(t,function(e,s){var o=s[2],u=s[3];r[s[1]]=o.add,u&&o.add(function(){n=u},t[e^1][2].disable,t[2][2].lock),i[s[0]]=function(){return i[s[0]+"With"](this===i?r:this,arguments),this},i[s[0]+"With"]=o.fireWith}),r.promise(i),e&&e.call(i,i),i},when:function(e){var t=0,n=slice.call(arguments),r=n.length,i=r!==1||e&&jQuery.isFunction(e.promise)?r:0,s=i===1?e:jQuery.Deferred(),o=function(e,t,n){return function(r){t[e]=this,n[e]=arguments.length>1?slice.call(arguments):r,n===u?s.notifyWith(t,n):--i||s.resolveWith(t,n)}},u,a,f;if(r>1){u=new Array(r),a=new Array(r),f=new Array(r);for(;t<r;t++)n[t]&&jQuery.isFunction(n[t].promise)?n[t].promise().done(o(t,f,n)).fail(s.reject).progress(o(t,a,u)):--i}return i||s.resolveWith(f,n),s.promise()}});var readyList;jQuery.fn.ready=function(e){return jQuery.ready.promise().done(e),this},jQuery.extend({isReady:!1,readyWait:1,holdReady:function(e){e?jQuery.readyWait++:jQuery.ready(!0)},ready:function(e){if(e===!0?--jQuery.readyWait:jQuery.isReady)return;jQuery.isReady=!0;if(e!==!0&&--jQuery.readyWait>0)return;readyList.resolveWith(document,[jQuery]),jQuery.fn.triggerHandler&&(jQuery(document).triggerHandler("ready"),jQuery(document).off("ready"))}}),jQuery.ready.promise=function(e){return readyList||(readyList=jQuery.Deferred(),document.readyState==="complete"?setTimeout(jQuery.ready):(document.addEventListener("DOMContentLoaded",completed,!1),window.addEventListener("load",completed,!1))),readyList.promise(e)},jQuery.ready.promise();var access=jQuery.access=function(e,t,n,r,i,s,o){var u=0,a=e.length,f=n==null;if(jQuery.type(n)==="object"){i=!0;for(u in n)jQuery.access(e,t,u,n[u],!0,s,o)}else if(r!==undefined){i=!0,jQuery.isFunction(r)||(o=!0),f&&(o?(t.call(e,r),t=null):(f=t,t=function(e,t,n){return f.call(jQuery(e),n)}));if(t)for(;u<a;u++)t(e[u],n,o?r:r.call(e[u],u,t(e[u],n)))}return i?e:f?t.call(e):a?t(e[0],n):s};jQuery.acceptData=function(e){return e.nodeType===1||e.nodeType===9||!+e.nodeType},Data.uid=1,Data.accepts=jQuery.acceptData,Data.prototype={key:function(e){if(!Data.accepts(e))return 0;var t={},n=e[this.expando];if(!n){n=Data.uid++;try{t[this.expando]={value:n},Object.defineProperties(e,t)}catch(r){t[this.expando]=n,jQuery.extend(e,t)}}return this.cache[n]||(this.cache[n]={}),n},set:function(e,t,n){var r,i=this.key(e),s=this.cache[i];if(typeof t=="string")s[t]=n;else if(jQuery.isEmptyObject(s))jQuery.extend(this.cache[i],t);else for(r in t)s[r]=t[r];return s},get:function(e,t){var n=this.cache[this.key(e)];return t===undefined?n:n[t]},access:function(e,t,n){var r;return t===undefined||t&&typeof t=="string"&&n===undefined?(r=this.get(e,t),r!==undefined?r:this.get(e,jQuery.camelCase(t))):(this.set(e,t,n),n!==undefined?n:t)},remove:function(e,t){var n,r,i,s=this.key(e),o=this.cache[s];if(t===undefined)this.cache[s]={};else{jQuery.isArray(t)?r=t.concat(t.map(jQuery.camelCase)):(i=jQuery.camelCase(t),t in o?r=[t,i]:(r=i,r=r in o?[r]:r.match(rnotwhite)||[])),n=r.length;while(n--)delete o[r[n]]}},hasData:function(e){return!jQuery.isEmptyObject(this.cache[e[this.expando]]||{})},discard:function(e){e[this.expando]&&delete this.cache[e[this.expando]]}};var data_priv=new Data,data_user=new Data,rbrace=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,rmultiDash=/([A-Z])/g;jQuery.extend({hasData:function(e){return data_user.hasData(e)||data_priv.hasData(e)},data:function(e,t,n){return data_user.access(e,t,n)},removeData:function(e,t){data_user.remove(e,t)},_data:function(e,t,n){return data_priv.access(e,t,n)},_removeData:function(e,t){data_priv.remove(e,t)}}),jQuery.fn.extend({data:function(e,t){var n,r,i,s=this[0],o=s&&s.attributes;if(e===undefined){if(this.length){i=data_user.get(s);if(s.nodeType===1&&!data_priv.get(s,"hasDataAttrs")){n=o.length;while(n--)o[n]&&(r=o[n].name,r.indexOf("data-")===0&&(r=jQuery.camelCase(r.slice(5)),dataAttr(s,r,i[r])));data_priv.set(s,"hasDataAttrs",!0)}}return i}return typeof e=="object"?this.each(function(){data_user.set(this,e)}):access(this,function(t){var n,r=jQuery.camelCase(e);if(s&&t===undefined){n=data_user.get(s,e);if(n!==undefined)return n;n=data_user.get(s,r);if(n!==undefined)return n;n=dataAttr(s,r,undefined);if(n!==undefined)return n;return}this.each(function(){var n=data_user.get(this,r);data_user.set(this,r,t),e.indexOf("-")!==-1&&n!==undefined&&data_user.set(this,e,t)})},null,t,arguments.length>1,null,!0)},removeData:function(e){return this.each(function(){data_user.remove(this,e)})}}),jQuery.extend({queue:function(e,t,n){var r;if(e)return t=(t||"fx")+"queue",r=data_priv.get(e,t),n&&(!r||jQuery.isArray(n)?r=data_priv.access(e,t,jQuery.makeArray(n)):r.push(n)),r||[]},dequeue:function(e,t){t=t||"fx";var n=jQuery.queue(e,t),r=n.length,i=n.shift(),s=jQuery._queueHooks(e,t),o=function(){jQuery.dequeue(e,t)};i==="inprogress"&&(i=n.shift(),r--),i&&(t==="fx"&&n.unshift("inprogress"),delete s.stop,i.call(e,o,s)),!r&&s&&s.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return data_priv.get(e,n)||data_priv.access(e,n,{empty:jQuery.Callbacks("once memory").add(function(){data_priv.remove(e,[t+"queue",n])})})}}),jQuery.fn.extend({queue:function(e,t){var n=2;return typeof e!="string"&&(t=e,e="fx",n--),arguments.length<n?jQuery.queue(this[0],e):t===undefined?this:this.each(function(){var n=jQuery.queue(this,e,t);jQuery._queueHooks(this,e),e==="fx"&&n[0]!=="inprogress"&&jQuery.dequeue(this,e)})},dequeue:function(e){return this.each(function(){jQuery.dequeue(this,e)})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,t){var n,r=1,i=jQuery.Deferred(),s=this,o=this.length,u=function(){--r||i.resolveWith(s,[s])};typeof e!="string"&&(t=e,e=undefined),e=e||"fx";while(o--)n=data_priv.get(s[o],e+"queueHooks"),n&&n.empty&&(r++,n.empty.add(u));return u(),i.promise(t)}});var pnum=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,cssExpand=["Top","Right","Bottom","Left"],isHidden=function(e,t){return e=t||e,jQuery.css(e,"display")==="none"||!jQuery.contains(e.ownerDocument,e)},rcheckableType=/^(?:checkbox|radio)$/i;(function(){var e=document.createDocumentFragment(),t=e.appendChild(document.createElement("div")),n=document.createElement("input");n.setAttribute("type","radio"),n.setAttribute("checked","checked"),n.setAttribute("name","t"),t.appendChild(n),support.checkClone=t.cloneNode(!0).cloneNode(!0).lastChild.checked,t.innerHTML="<textarea>x</textarea>",support.noCloneChecked=!!t.cloneNode(!0).lastChild.defaultValue})();var strundefined=typeof undefined;support.focusinBubbles="onfocusin"in window;var rkeyEvent=/^key/,rmouseEvent=/^(?:mouse|pointer|contextmenu)|click/,rfocusMorph=/^(?:focusinfocus|focusoutblur)$/,rtypenamespace=/^([^.]*)(?:\.(.+)|)$/;jQuery.event={global:{},add:function(e,t,n,r,i){var s,o,u,a,f,l,c,h,p,d,v,m=data_priv.get(e);if(!m)return;n.handler&&(s=n,n=s.handler,i=s.selector),n.guid||(n.guid=jQuery.guid++),(a=m.events)||(a=m.events={}),(o=m.handle)||(o=m.handle=function(t){return typeof jQuery!==strundefined&&jQuery.event.triggered!==t.type?jQuery.event.dispatch.apply(e,arguments):undefined}),t=(t||"").match(rnotwhite)||[""],f=t.length;while(f--){u=rtypenamespace.exec(t[f])||[],p=v=u[1],d=(u[2]||"").split(".").sort();if(!p)continue;c=jQuery.event.special[p]||{},p=(i?c.delegateType:c.bindType)||p,c=jQuery.event.special[p]||{},l=jQuery.extend({type:p,origType:v,data:r,handler:n,guid:n.guid,selector:i,needsContext:i&&jQuery.expr.match.needsContext.test(i),namespace:d.join(".")},s),(h=a[p])||(h=a[p]=[],h.delegateCount=0,(!c.setup||c.setup.call(e,r,d,o)===!1)&&e.addEventListener&&e.addEventListener(p,o,!1)),c.add&&(c.add.call(e,l),l.handler.guid||(l.handler.guid=n.guid)),i?h.splice(h.delegateCount++,0,l):h.push(l),jQuery.event.global[p]=!0}},remove:function(e,t,n,r,i){var s,o,u,a,f,l,c,h,p,d,v,m=data_priv.hasData(e)&&data_priv.get(e);if(!m||!(a=m.events))return;t=(t||"").match(rnotwhite)||[""],f=t.length;while(f--){u=rtypenamespace.exec(t[f])||[],p=v=u[1],d=(u[2]||"").split(".").sort();if(!p){for(p in a)jQuery.event.remove(e,p+t[f],n,r,!0);continue}c=jQuery.event.special[p]||{},p=(r?c.delegateType:c.bindType)||p,h=a[p]||[],u=u[2]&&new RegExp("(^|\\.)"+d.join("\\.(?:.*\\.|)")+"(\\.|$)"),o=s=h.length;while(s--)l=h[s],(i||v===l.origType)&&(!n||n.guid===l.guid)&&(!u||u.test(l.namespace))&&(!r||r===l.selector||r==="**"&&l.selector)&&(h.splice(s,1),l.selector&&h.delegateCount--,c.remove&&c.remove.call(e,l));o&&!h.length&&((!c.teardown||c.teardown.call(e,d,m.handle)===!1)&&jQuery.removeEvent(e,p,m.handle),delete a[p])}jQuery.isEmptyObject(a)&&(delete m.handle,data_priv.remove(e,"events"))},trigger:function(e,t,n,r){var i,s,o,u,a,f,l,c=[n||document],h=hasOwn.call(e,"type")?e.type:e,p=hasOwn.call(e,"namespace")?e.namespace.split("."):[];s=o=n=n||document;if(n.nodeType===3||n.nodeType===8)return;if(rfocusMorph.test(h+jQuery.event.triggered))return;h.indexOf(".")>=0&&(p=h.split("."),h=p.shift(),p.sort()),a=h.indexOf(":")<0&&"on"+h,e=e[jQuery.expando]?e:new jQuery.Event(h,typeof e=="object"&&e),e.isTrigger=r?2:3,e.namespace=p.join("."),e.namespace_re=e.namespace?new RegExp("(^|\\.)"+p.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,e.result=undefined,e.target||(e.target=n),t=t==null?[e]:jQuery.makeArray(t,[e]),l=jQuery.event.special[h]||{};if(!r&&l.trigger&&l.trigger.apply(n,t)===!1)return;if(!r&&!l.noBubble&&!jQuery.isWindow(n)){u=l.delegateType||h,rfocusMorph.test(u+h)||(s=s.parentNode);for(;s;s=s.parentNode)c.push(s),o=s;o===(n.ownerDocument||document)&&c.push(o.defaultView||o.parentWindow||window)}i=0;while((s=c[i++])&&!e.isPropagationStopped())e.type=i>1?u:l.bindType||h,f=(data_priv.get(s,"events")||{})[e.type]&&data_priv.get(s,"handle"),f&&f.apply(s,t),f=a&&s[a],f&&f.apply&&jQuery.acceptData(s)&&(e.result=f.apply(s,t),e.result===!1&&e.preventDefault());return e.type=h,!r&&!e.isDefaultPrevented()&&(!l._default||l._default.apply(c.pop(),t)===!1)&&jQuery.acceptData(n)&&a&&jQuery.isFunction(n[h])&&!jQuery.isWindow(n)&&(o=n[a],o&&(n[a]=null),jQuery.event.triggered=h,n[h](),jQuery.event.triggered=undefined,o&&(n[a]=o)),e.result},dispatch:function(e){e=jQuery.event.fix(e);var t,n,r,i,s,o=[],u=slice.call(arguments),a=(data_priv.get(this,"events")||{})[e.type]||[],f=jQuery.event.special[e.type]||{};u[0]=e,e.delegateTarget=this;if(f.preDispatch&&f.preDispatch.call(this,e)===!1)return;o=jQuery.event.handlers.call(this,e,a),t=0;while((i=o[t++])&&!e.isPropagationStopped()){e.currentTarget=i.elem,n=0;while((s=i.handlers[n++])&&!e.isImmediatePropagationStopped())if(!e.namespace_re||e.namespace_re.test(s.namespace))e.handleObj=s,e.data=s.data,r=((jQuery.event.special[s.origType]||{}).handle||s.handler).apply(i.elem,u),r!==undefined&&(e.result=r)===!1&&(e.preventDefault(),e.stopPropagation())}return f.postDispatch&&f.postDispatch.call(this,e),e.result},handlers:function(e,t){var n,r,i,s,o=[],u=t.delegateCount,a=e.target;if(u&&a.nodeType&&(!e.button||e.type!=="click"))for(;a!==this;a=a.parentNode||this)if(a.disabled!==!0||e.type!=="click"){r=[];for(n=0;n<u;n++)s=t[n],i=s.selector+" ",r[i]===undefined&&(r[i]=s.needsContext?jQuery(i,this).index(a)>=0:jQuery.find(i,this,null,[a]).length),r[i]&&r.push(s);r.length&&o.push({elem:a,handlers:r})}return u<t.length&&o.push({elem:this,handlers:t.slice(u)}),o},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(e,t){return e.which==null&&(e.which=t.charCode!=null?t.charCode:t.keyCode),e}},mouseHooks:{props:"button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(e,t){var n,r,i,s=t.button;return e.pageX==null&&t.clientX!=null&&(n=e.target.ownerDocument||document,r=n.documentElement,i=n.body,e.pageX=t.clientX+(r&&r.scrollLeft||i&&i.scrollLeft||0)-(r&&r.clientLeft||i&&i.clientLeft||0),e.pageY=t.clientY+(r&&r.scrollTop||i&&i.scrollTop||0)-(r&&r.clientTop||i&&i.clientTop||0)),!e.which&&s!==undefined&&(e.which=s&1?1:s&2?3:s&4?2:0),e}},fix:function(e){if(e[jQuery.expando])return e;var t,n,r,i=e.type,s=e,o=this.fixHooks[i];o||(this.fixHooks[i]=o=rmouseEvent.test(i)?this.mouseHooks:rkeyEvent.test(i)?this.keyHooks:{}),r=o.props?this.props.concat(o.props):this.props,e=new jQuery.Event(s),t=r.length;while(t--)n=r[t],e[n]=s[n];return e.target||(e.target=document),e.target.nodeType===3&&(e.target=e.target.parentNode),o.filter?o.filter(e,s):e},special:{load:{noBubble:!0},focus:{trigger:function(){if(this!==safeActiveElement()&&this.focus)return this.focus(),!1},delegateType:"focusin"},blur:{trigger:function(){if(this===safeActiveElement()&&this.blur)return this.blur(),!1},delegateType:"focusout"},click:{trigger:function(){if(this.type==="checkbox"&&this.click&&jQuery.nodeName(this,"input"))return this.click(),!1},_default:function(e){return jQuery.nodeName(e.target,"a")}},beforeunload:{postDispatch:function(e){e.result!==undefined&&e.originalEvent&&(e.originalEvent.returnValue=e.result)}}},simulate:function(e,t,n,r){var i=jQuery.extend(new jQuery.Event,n,{type:e,isSimulated:!0,originalEvent:{}});r?jQuery.event.trigger(i,null,t):jQuery.event.dispatch.call(t,i),i.isDefaultPrevented()&&n.preventDefault()}},jQuery.removeEvent=function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n,!1)},jQuery.Event=function(e,t){if(!(this instanceof jQuery.Event))return new jQuery.Event(e,t);e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||e.defaultPrevented===undefined&&e.returnValue===!1?returnTrue:returnFalse):this.type=e,t&&jQuery.extend(this,t),this.timeStamp=e&&e.timeStamp||jQuery.now(),this[jQuery.expando]=!0},jQuery.Event.prototype={isDefaultPrevented:returnFalse,isPropagationStopped:returnFalse,isImmediatePropagationStopped:returnFalse,preventDefault:function(){var e=this.originalEvent;this.isDefaultPrevented=returnTrue,e&&e.preventDefault&&e.preventDefault()},stopPropagation:function(){var e=this.originalEvent;this.isPropagationStopped=returnTrue,e&&e.stopPropagation&&e.stopPropagation()},stopImmediatePropagation:function(){var e=this.originalEvent;this.isImmediatePropagationStopped=returnTrue,e&&e.stopImmediatePropagation&&e.stopImmediatePropagation(),this.stopPropagation()}},jQuery.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(e,t){jQuery.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,s=e.handleObj;if(!i||i!==r&&!jQuery.contains(r,i))e.type=s.origType,n=s.handler.apply(this,arguments),e.type=t;return n}}}),support.focusinBubbles||jQuery.each({focus:"focusin",blur:"focusout"},function(e,t){var n=function(e){jQuery.event.simulate(t,e.target,jQuery.event.fix(e),!0)};jQuery.event.special[t]={setup:function(){var r=this.ownerDocument||this,i=data_priv.access(r,t);i||r.addEventListener(e,n,!0),data_priv.access(r,t,(i||0)+1)},teardown:function(){var r=this.ownerDocument||this,i=data_priv.access(r,t)-1;i?data_priv.access(r,t,i):(r.removeEventListener(e,n,!0),data_priv.remove(r,t))}}}),jQuery.fn.extend({on:function(e,t,n,r,i){var s,o;if(typeof e=="object"){typeof t!="string"&&(n=n||t,t=undefined);for(o in e)this.on(o,t,n,e[o],i);return this}n==null&&r==null?(r=t,n=t=undefined):r==null&&(typeof t=="string"?(r=n,n=undefined):(r=n,n=t,t=undefined));if(r===!1)r=returnFalse;else if(!r)return this;return i===1&&(s=r,r=function(e){return jQuery().off(e),s.apply(this,arguments)},r.guid=s.guid||(s.guid=jQuery.guid++)),this.each(function(){jQuery.event.add(this,e,r,n,t)})},one:function(e,t,n,r){return this.on(e,t,n,r,1)},off:function(e,t,n){var r,i;if(e&&e.preventDefault&&e.handleObj)return r=e.handleObj,jQuery(e.delegateTarget).off(r.namespace?r.origType+"."+r.namespace:r.origType,r.selector,r.handler),this;if(typeof e=="object"){for(i in e)this.off(i,t,e[i]);return this}if(t===!1||typeof t=="function")n=t,t=undefined;return n===!1&&(n=returnFalse),this.each(function(){jQuery.event.remove(this,e,n,t)})},trigger:function(e,t){return this.each(function(){jQuery.event.trigger(e,t,this)})},triggerHandler:function(e,t){var n=this[0];if(n)return jQuery.event.trigger(e,t,n,!0)}});var rxhtmlTag=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,rtagName=/<([\w:]+)/,rhtml=/<|&#?\w+;/,rnoInnerhtml=/<(?:script|style|link)/i,rchecked=/checked\s*(?:[^=]|=\s*.checked.)/i,rscriptType=/^$|\/(?:java|ecma)script/i,rscriptTypeMasked=/^true\/(.*)/,rcleanScript=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,wrapMap={option:[1,"<select multiple='multiple'>","</select>"],thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};wrapMap.optgroup=wrapMap.option,wrapMap.tbody=wrapMap.tfoot=wrapMap.colgroup=wrapMap.caption=wrapMap.thead,wrapMap.th=wrapMap.td,jQuery.extend({clone:function(e,t,n){var r,i,s,o,u=e.cloneNode(!0),a=jQuery.contains(e.ownerDocument,e);if(!support.noCloneChecked&&(e.nodeType===1||e.nodeType===11)&&!jQuery.isXMLDoc(e)){o=getAll(u),s=getAll(e);for(r=0,i=s.length;r<i;r++)fixInput(s[r],o[r])}if(t)if(n){s=s||getAll(e),o=o||getAll(u);for(r=0,i=s.length;r<i;r++)cloneCopyEvent(s[r],o[r])}else cloneCopyEvent(e,u);return o=getAll(u,"script"),o.length>0&&setGlobalEval(o,!a&&getAll(e,"script")),u},buildFragment:function(e,t,n,r){var i,s,o,u,a,f,l=t.createDocumentFragment(),c=[],h=0,p=e.length;for(;h<p;h++){i=e[h];if(i||i===0)if(jQuery.type(i)==="object")jQuery.merge(c,i.nodeType?[i]:i);else if(!rhtml.test(i))c.push(t.createTextNode(i));else{s=s||l.appendChild(t.createElement("div")),o=(rtagName.exec(i)||["",""])[1].toLowerCase(),u=wrapMap[o]||wrapMap._default,s.innerHTML=u[1]+i.replace(rxhtmlTag,"<$1></$2>")+u[2],f=u[0];while(f--)s=s.lastChild;jQuery.merge(c,s.childNodes),s=l.firstChild,s.textContent=""}}l.textContent="",h=0;while(i=c[h++]){if(r&&jQuery.inArray(i,r)!==-1)continue;a=jQuery.contains(i.ownerDocument,i),s=getAll(l.appendChild(i),"script"),a&&setGlobalEval(s);if(n){f=0;while(i=s[f++])rscriptType.test(i.type||"")&&n.push(i)}}return l},cleanData:function(e){var t,n,r,i,s=jQuery.event.special,o=0;for(;(n=e[o])!==undefined;o++){if(jQuery.acceptData(n)){i=n[data_priv.expando];if(i&&(t=data_priv.cache[i])){if(t.events)for(r in t.events)s[r]?jQuery.event.remove(n,r):jQuery.removeEvent(n,r,t.handle);data_priv.cache[i]&&delete data_priv.cache[i]}}delete data_user.cache[n[data_user.expando]]}}}),jQuery.fn.extend({text:function(e){return access(this,function(e){return e===undefined?jQuery.text(this):this.empty().each(function(){if(this.nodeType===1||this.nodeType===11||this.nodeType===9)this.textContent=e})},null,e,arguments.length)},append:function(){return this.domManip(arguments,function(e){if(this.nodeType===1||this.nodeType===11||this.nodeType===9){var t=manipulationTarget(this,e);t.appendChild(e)}})},prepend:function(){return this.domManip(arguments,function(e){if(this.nodeType===1||this.nodeType===11||this.nodeType===9){var t=manipulationTarget(this,e);t.insertBefore(e,t.firstChild)}})},before:function(){return this.domManip(arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this)})},after:function(){return this.domManip(arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this.nextSibling)})},remove:function(e,t){var n,r=e?jQuery.filter(e,this):this,i=0;for(;(n=r[i])!=null;i++)!t&&n.nodeType===1&&jQuery.cleanData(getAll(n)),n.parentNode&&(t&&jQuery.contains(n.ownerDocument,n)&&setGlobalEval(getAll(n,"script")),n.parentNode.removeChild(n));return this},empty:function(){var e,t=0;for(;(e=this[t])!=null;t++)e.nodeType===1&&(jQuery.cleanData(getAll(e,!1)),e.textContent="");return this},clone:function(e,t){return e=e==null?!1:e,t=t==null?e:t,this.map(function(){return jQuery.clone(this,e,t)})},html:function(e){return access(this,function(e){var t=this[0]||{},n=0,r=this.length;if(e===undefined&&t.nodeType===1)return t.innerHTML;if(typeof e=="string"&&!rnoInnerhtml.test(e)&&!wrapMap[(rtagName.exec(e)||["",""])[1].toLowerCase()]){e=e.replace(rxhtmlTag,"<$1></$2>");try{for(;n<r;n++)t=this[n]||{},t.nodeType===1&&(jQuery.cleanData(getAll(t,!1)),t.innerHTML=e);t=0}catch(i){}}t&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(){var e=arguments[0];return this.domManip(arguments,function(t){e=this.parentNode,jQuery.cleanData(getAll(this)),e&&e.replaceChild(t,this)}),e&&(e.length||e.nodeType)?this:this.remove()},detach:function(e){return this.remove(e,!0)},domManip:function(e,t){e=concat.apply([],e);var n,r,i,s,o,u,a=0,f=this.length,l=this,c=f-1,h=e[0],p=jQuery.isFunction(h);if(p||f>1&&typeof h=="string"&&!support.checkClone&&rchecked.test(h))return this.each(function(n){var r=l.eq(n);p&&(e[0]=h.call(this,n,r.html())),r.domManip(e,t)});if(f){n=jQuery.buildFragment(e,this[0].ownerDocument,!1,this),r=n.firstChild,n.childNodes.length===1&&(n=r);if(r){i=jQuery.map(getAll(n,"script"),disableScript),s=i.length;for(;a<f;a++)o=n,a!==c&&(o=jQuery.clone(o,!0,!0),s&&jQuery.merge(i,getAll(o,"script"))),t.call(this[a],o,a);if(s){u=i[i.length-1].ownerDocument,jQuery.map(i,restoreScript);for(a=0;a<s;a++)o=i[a],rscriptType.test(o.type||"")&&!data_priv.access(o,"globalEval")&&jQuery.contains(u,o)&&(o.src?jQuery._evalUrl&&jQuery._evalUrl(o.src):jQuery.globalEval(o.textContent.replace(rcleanScript,"")))}}}return this}}),jQuery.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){jQuery.fn[e]=function(e){var n,r=[],i=jQuery(e),s=i.length-1,o=0;for(;o<=s;o++)n=o===s?this:this.clone(!0),jQuery(i[o])[t](n),push.apply(r,n.get());return this.pushStack(r)}});var iframe,elemdisplay={},rmargin=/^margin/,rnumnonpx=new RegExp("^("+pnum+")(?!px)[a-z%]+$","i"),getStyles=function(e){return e.ownerDocument.defaultView.opener?e.ownerDocument.defaultView.getComputedStyle(e,null):window.getComputedStyle(e,null)};(function(){function s(){i.style.cssText="-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;display:block;margin-top:1%;top:1%;border:1px;padding:1px;width:4px;position:absolute",i.innerHTML="",n.appendChild(r);var s=window.getComputedStyle(i,null);e=s.top!=="1%",t=s.width==="4px",n.removeChild(r)}var e,t,n=document.documentElement,r=document.createElement("div"),i=document.createElement("div");if(!i.style)return;i.style.backgroundClip="content-box",i.cloneNode(!0).style.backgroundClip="",support.clearCloneStyle=i.style.backgroundClip==="content-box",r.style.cssText="border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;position:absolute",r.appendChild(i),window.getComputedStyle&&jQuery.extend(support,{pixelPosition:function(){return s(),e},boxSizingReliable:function(){return t==null&&s(),t},reliableMarginRight:function(){var e,t=i.appendChild(document.createElement("div"));return t.style.cssText=i.style.cssText="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0",t.style.marginRight=t.style.width="0",i.style.width="1px",n.appendChild(r),e=!parseFloat(window.getComputedStyle(t,null).marginRight),n.removeChild(r),i.removeChild(t),e}})})(),jQuery.swap=function(e,t,n,r){var i,s,o={};for(s in t)o[s]=e.style[s],e.style[s]=t[s];i=n.apply(e,r||[]);for(s in t)e.style[s]=o[s];return i};var rdisplayswap=/^(none|table(?!-c[ea]).+)/,rnumsplit=new RegExp("^("+pnum+")(.*)$","i"),rrelNum=new RegExp("^([+-])=("+pnum+")","i"),cssShow={position:"absolute",visibility:"hidden",display:"block"},cssNormalTransform={letterSpacing:"0",fontWeight:"400"},cssPrefixes=["Webkit","O","Moz","ms"];jQuery.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=curCSS(e,"opacity");return n===""?"1":n}}}},cssNumber:{columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":"cssFloat"},style:function(e,t,n,r){if(!e||e.nodeType===3||e.nodeType===8||!e.style)return;var i,s,o,u=jQuery.camelCase(t),a=e.style;t=jQuery.cssProps[u]||(jQuery.cssProps[u]=vendorPropName(a,u)),o=jQuery.cssHooks[t]||jQuery.cssHooks[u];if(n===undefined)return o&&"get"in o&&(i=o.get(e,!1,r))!==undefined?i:a[t];s=typeof n,s==="string"&&(i=rrelNum.exec(n))&&(n=(i[1]+1)*i[2]+parseFloat(jQuery.css(e,t)),s="number");if(n==null||n!==n)return;s==="number"&&!jQuery.cssNumber[u]&&(n+="px"),!support.clearCloneStyle&&n===""&&t.indexOf("background")===0&&(a[t]="inherit");if(!o||!("set"in o)||(n=o.set(e,n,r))!==undefined)a[t]=n},css:function(e,t,n,r){var i,s,o,u=jQuery.camelCase(t);return t=jQuery.cssProps[u]||(jQuery.cssProps[u]=vendorPropName(e.style,u)),o=jQuery.cssHooks[t]||jQuery.cssHooks[u],o&&"get"in o&&(i=o.get(e,!0,n)),i===undefined&&(i=curCSS(e,t,r)),i==="normal"&&t in cssNormalTransform&&(i=cssNormalTransform[t]),n===""||n?(s=parseFloat(i),n===!0||jQuery.isNumeric(s)?s||0:i):i}}),jQuery.each(["height","width"],function(e,t){jQuery.cssHooks[t]={get:function(e,n,r){if(n)return rdisplayswap.test(jQuery.css(e,"display"))&&e.offsetWidth===0?jQuery.swap(e,cssShow,function(){return getWidthOrHeight(e,t,r)}):getWidthOrHeight(e,t,r)},set:function(e,n,r){var i=r&&getStyles(e);return setPositiveNumber(e,n,r?augmentWidthOrHeight(e,t,r,jQuery.css(e,"boxSizing",!1,i)==="border-box",i):0)}}}),jQuery.cssHooks.marginRight=addGetHookIf(support.reliableMarginRight,function(e,t){if(t)return jQuery.swap(e,{display:"inline-block"},curCSS,[e,"marginRight"])}),jQuery.each({margin:"",padding:"",border:"Width"},function(e,t){jQuery.cssHooks[e+t]={expand:function(n){var r=0,i={},s=typeof n=="string"?n.split(" "):[n];for(;r<4;r++)i[e+cssExpand[r]+t]=s[r]||s[r-2]||s[0];return i}},rmargin.test(e)||(jQuery.cssHooks[e+t].set=setPositiveNumber)}),jQuery.fn.extend({css:function(e,t){return access(this,function(e,t,n){var r,i,s={},o=0;if(jQuery.isArray(t)){r=getStyles(e),i=t.length;for(;o<i;o++)s[t[o]]=jQuery.css(e,t[o],!1,r);return s}return n!==undefined?jQuery.style(e,t,n):jQuery.css(e,t)},e,t,arguments.length>1)},show:function(){return showHide(this,!0)},hide:function(){return showHide(this)},toggle:function(e){return typeof e=="boolean"?e?this.show():this.hide():this.each(function(){isHidden(this)?jQuery(this).show():jQuery(this).hide()})}}),jQuery.Tween=Tween,Tween.prototype={constructor:Tween,init:function(e,t,n,r,i,s){this.elem=e,this.prop=n,this.easing=i||"swing",this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=s||(jQuery.cssNumber[n]?"":"px")},cur:function(){var e=Tween.propHooks[this.prop];return e&&e.get?e.get(this):Tween.propHooks._default.get(this)},run:function(e){var t,n=Tween.propHooks[this.prop];return this.options.duration?this.pos=t=jQuery.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):this.pos=t=e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):Tween.propHooks._default.set(this),this}},Tween.prototype.init.prototype=Tween.prototype,Tween.propHooks={_default:{get:function(e){var t;return e.elem[e.prop]==null||!!e.elem.style&&e.elem.style[e.prop]!=null?(t=jQuery.css(e.elem,e.prop,""),!t||t==="auto"?0:t):e.elem[e.prop]},set:function(e){jQuery.fx.step[e.prop]?jQuery.fx.step[e.prop](e):e.elem.style&&(e.elem.style[jQuery.cssProps[e.prop]]!=null||jQuery.cssHooks[e.prop])?jQuery.style(e.elem,e.prop,e.now+e.unit):e.elem[e.prop]=e.now}}},Tween.propHooks.scrollTop=Tween.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},jQuery.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2}},jQuery.fx=Tween.prototype.init,jQuery.fx.step={};var fxNow,timerId,rfxtypes=/^(?:toggle|show|hide)$/,rfxnum=new RegExp("^(?:([+-])=|)("+pnum+")([a-z%]*)$","i"),rrun=/queueHooks$/,animationPrefilters=[defaultPrefilter],tweeners={"*":[function(e,t){var n=this.createTween(e,t),r=n.cur(),i=rfxnum.exec(t),s=i&&i[3]||(jQuery.cssNumber[e]?"":"px"),o=(jQuery.cssNumber[e]||s!=="px"&&+r)&&rfxnum.exec(jQuery.css(n.elem,e)),u=1,a=20;if(o&&o[3]!==s){s=s||o[3],i=i||[],o=+r||1;do u=u||".5",o/=u,jQuery.style(n.elem,e,o+s);while(u!==(u=n.cur()/r)&&u!==1&&--a)}return i&&(o=n.start=+o||+r||0,n.unit=s,n.end=i[1]?o+(i[1]+1)*i[2]:+i[2]),n}]};jQuery.Animation=jQuery.extend(Animation,{tweener:function(e,t){jQuery.isFunction(e)?(t=e,e=["*"]):e=e.split(" ");var n,r=0,i=e.length;for(;r<i;r++)n=e[r],tweeners[n]=tweeners[n]||[],tweeners[n].unshift(t)},prefilter:function(e,t){t?animationPrefilters.unshift(e):animationPrefilters.push(e)}}),jQuery.speed=function(e,t,n){var r=e&&typeof e=="object"?jQuery.extend({},e):{complete:n||!n&&t||jQuery.isFunction(e)&&e,duration:e,easing:n&&t||t&&!jQuery.isFunction(t)&&t};r.duration=jQuery.fx.off?0:typeof r.duration=="number"?r.duration:r.duration in jQuery.fx.speeds?jQuery.fx.speeds[r.duration]:jQuery.fx.speeds._default;if(r.queue==null||r.queue===!0)r.queue="fx";return r.old=r.complete,r.complete=function(){jQuery.isFunction(r.old)&&r.old.call(this),r.queue&&jQuery.dequeue(this,r.queue)},r},jQuery.fn.extend({fadeTo:function(e,t,n,r){return this.filter(isHidden).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=jQuery.isEmptyObject(e),s=jQuery.speed(t,n,r),o=function(){var t=Animation(this,jQuery.extend({},e),s);(i||data_priv.get(this,"finish"))&&t.stop(!0)};return o.finish=o,i||s.queue===!1?this.each(o):this.queue(s.queue,o)},stop:function(e,t,n){var r=function(e){var t=e.stop;delete e.stop,t(n)};return typeof e!="string"&&(n=t,t=e,e=undefined),t&&e!==!1&&this.queue(e||"fx",[]),this.each(function(){var t=!0,i=e!=null&&e+"queueHooks",s=jQuery.timers,o=data_priv.get(this);if(i)o[i]&&o[i].stop&&r(o[i]);else for(i in o)o[i]&&o[i].stop&&rrun.test(i)&&r(o[i]);for(i=s.length;i--;)s[i].elem===this&&(e==null||s[i].queue===e)&&(s[i].anim.stop(n),t=!1,s.splice(i,1));(t||!n)&&jQuery.dequeue(this,e)})},finish:function(e){return e!==!1&&(e=e||"fx"),this.each(function(){var t,n=data_priv.get(this),r=n[e+"queue"],i=n[e+"queueHooks"],s=jQuery.timers,o=r?r.length:0;n.finish=!0,jQuery.queue(this,e,[]),i&&i.stop&&i.stop.call(this,!0);for(t=s.length;t--;)s[t].elem===this&&s[t].queue===e&&(s[t].anim.stop(!0),s.splice(t,1));for(t=0;t<o;t++)r[t]&&r[t].finish&&r[t].finish.call(this);delete n.finish})}}),jQuery.each(["toggle","show","hide"],function(e,t){var n=jQuery.fn[t];jQuery.fn[t]=function(e,r,i){return e==null||typeof e=="boolean"?n.apply(this,arguments):this.animate(genFx(t,!0),e,r,i)}}),jQuery.each({slideDown:genFx("show"),slideUp:genFx("hide"),slideToggle:genFx("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){jQuery.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),jQuery.timers=[],jQuery.fx.tick=function(){var e,t=0,n=jQuery.timers;fxNow=jQuery.now();for(;t<n.length;t++)e=n[t],!e()&&n[t]===e&&n.splice(t--,1);n.length||jQuery.fx.stop(),fxNow=undefined},jQuery.fx.timer=function(e){jQuery.timers.push(e),e()?jQuery.fx.start():jQuery.timers.pop()},jQuery.fx.interval=13,jQuery.fx.start=function(){timerId||(timerId=setInterval(jQuery.fx.tick,jQuery.fx.interval))},jQuery.fx.stop=function(){clearInterval(timerId),timerId=null},jQuery.fx.speeds={slow:600,fast:200,_default:400},jQuery.fn.delay=function(e,t){return e=jQuery.fx?jQuery.fx.speeds[e]||e:e,t=t||"fx",this.queue(t,function(t,n){var r=setTimeout(t,e);n.stop=function(){clearTimeout(r)}})},function(){var e=document.createElement("input"),t=document.createElement("select"),n=t.appendChild(document.createElement("option"));e.type="checkbox",support.checkOn=e.value!=="",support.optSelected=n.selected,t.disabled=!0,support.optDisabled=!n.disabled,e=document.createElement("input"),e.value="t",e.type="radio",support.radioValue=e.value==="t"}();var nodeHook,boolHook,attrHandle=jQuery.expr.attrHandle;jQuery.fn.extend({attr:function(e,t){return access(this,jQuery.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){jQuery.removeAttr(this,e)})}}),jQuery.extend({attr:function(e,t,n){var r,i,s=e.nodeType;if(!e||s===3||s===8||s===2)return;if(typeof e.getAttribute===strundefined)return jQuery.prop(e,t,n);if(s!==1||!jQuery.isXMLDoc(e))t=t.toLowerCase(),r=jQuery.attrHooks[t]||(jQuery.expr.match.bool.test(t)?boolHook:nodeHook);if(n===undefined)return r&&"get"in r&&(i=r.get(e,t))!==null?i:(i=jQuery.find.attr(e,t),i==null?undefined:i);if(n!==null)return r&&"set"in r&&(i=r.set(e,n,t))!==undefined?i:(e.setAttribute(t,n+""),n);jQuery.removeAttr(e,t)},removeAttr:function(e,t){var n,r,i=0,s=t&&t.match(rnotwhite);if(s&&e.nodeType===1)while(n=s[i++])r=jQuery.propFix[n]||n,jQuery.expr.match.bool.test(n)&&(e[r]=!1),e.removeAttribute(n)},attrHooks:{type:{set:function(e,t){if(!support.radioValue&&t==="radio"&&jQuery.nodeName(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}}}}),boolHook={set:function(e,t,n){return t===!1?jQuery.removeAttr(e,n):e.setAttribute(n,n),n}},jQuery.each(jQuery.expr.match.bool.source.match(/\w+/g),function(e,t){var n=attrHandle[t]||jQuery.find.attr;attrHandle[t]=function(e,t,r){var i,s;return r||(s=attrHandle[t],attrHandle[t]=i,i=n(e,t,r)!=null?t.toLowerCase():null,attrHandle[t]=s),i}});var rfocusable=/^(?:input|select|textarea|button)$/i;jQuery.fn.extend({prop:function(e,t){return access(this,jQuery.prop,e,t,arguments.length>1)},removeProp:function(e){return this.each(function(){delete this[jQuery.propFix[e]||e]})}}),jQuery.extend({propFix:{"for":"htmlFor","class":"className"},prop:function(e,t,n){var r,i,s,o=e.nodeType;if(!e||o===3||o===8||o===2)return;return s=o!==1||!jQuery.isXMLDoc(e),s&&(t=jQuery.propFix[t]||t,i=jQuery.propHooks[t]),n!==undefined?i&&"set"in i&&(r=i.set(e,n,t))!==undefined?r:e[t]=n:i&&"get"in i&&(r=i.get(e,t))!==null?r:e[t]},propHooks:{tabIndex:{get:function(e){return e.hasAttribute("tabindex")||rfocusable.test(e.nodeName)||e.href?e.tabIndex:-1}}}}),support.optSelected||(jQuery.propHooks.selected={get:function(e){var t=e.parentNode;return t&&t.parentNode&&t.parentNode.selectedIndex,null}}),jQuery.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){jQuery.propFix[this.toLowerCase()]=this});var rclass=/[\t\r\n\f]/g;jQuery.fn.extend({addClass:function(e){var t,n,r,i,s,o,u=typeof e=="string"&&e,a=0,f=this.length;if(jQuery.isFunction(e))return this.each(function(t){jQuery(this).addClass(e.call(this,t,this.className))});if(u){t=(e||"").match(rnotwhite)||[];for(;a<f;a++){n=this[a],r=n.nodeType===1&&(n.className?(" "+n.className+" ").replace(rclass," "):" ");if(r){s=0;while(i=t[s++])r.indexOf(" "+i+" ")<0&&(r+=i+" ");o=jQuery.trim(r),n.className!==o&&(n.className=o)}}}return this},removeClass:function(e){var t,n,r,i,s,o,u=arguments.length===0||typeof e=="string"&&e,a=0,f=this.length;if(jQuery.isFunction(e))return this.each(function(t){jQuery(this).removeClass(e.call(this,t,this.className))});if(u){t=(e||"").match(rnotwhite)||[];for(;a<f;a++){n=this[a],r=n.nodeType===1&&(n.className?(" "+n.className+" ").replace(rclass," "):"");if(r){s=0;while(i=t[s++])while(r.indexOf(" "+i+" ")>=0)r=r.replace(" "+i+" "," ");o=e?jQuery.trim(r):"",n.className!==o&&(n.className=o)}}}return this},toggleClass:function(e,t){var n=typeof e;return typeof t=="boolean"&&n==="string"?t?this.addClass(e):this.removeClass(e):jQuery.isFunction(e)?this.each(function(n){jQuery(this).toggleClass(e.call(this,n,this.className,t),t)}):this.each(function(){if(n==="string"){var t,r=0,i=jQuery(this),s=e.match(rnotwhite)||[];while(t=s[r++])i.hasClass(t)?i.removeClass(t):i.addClass(t)}else if(n===strundefined||n==="boolean")this.className&&data_priv.set(this,"__className__",this.className),this.className=this.className||e===!1?"":data_priv.get(this,"__className__")||""})},hasClass:function(e){var t=" "+e+" ",n=0,r=this.length;for(;n<r;n++)if(this[n].nodeType===1&&(" "+this[n].className+" ").replace(rclass," ").indexOf(t)>=0)return!0;return!1}});var rreturn=/\r/g;jQuery.fn.extend({val:function(e){var t,n,r,i=this[0];if(!arguments.length){if(i)return t=jQuery.valHooks[i.type]||jQuery.valHooks[i.nodeName.toLowerCase()],t&&"get"in t&&(n=t.get(i,"value"))!==undefined?n:(n=i.value,typeof n=="string"?n.replace(rreturn,""):n==null?"":n);return}return r=jQuery.isFunction(e),this.each(function(n){var i;if(this.nodeType!==1)return;r?i=e.call(this,n,jQuery(this).val()):i=e,i==null?i="":typeof i=="number"?i+="":jQuery.isArray(i)&&(i=jQuery.map(i,function(e){return e==null?"":e+""})),t=jQuery.valHooks[this.type]||jQuery.valHooks[this.nodeName.toLowerCase()];if(!t||!("set"in t)||t.set(this,i,"value")===undefined)this.value=i})}}),jQuery.extend({valHooks:{option:{get:function(e){var t=jQuery.find.attr(e,"value");return t!=null?t:jQuery.trim(jQuery.text(e))}},select:{get:function(e){var t,n,r=e.options,i=e.selectedIndex,s=e.type==="select-one"||i<0,o=s?null:[],u=s?i+1:r.length,a=i<0?u:s?i:0;for(;a<u;a++){n=r[a];if((n.selected||a===i)&&(support.optDisabled?!n.disabled:n.getAttribute("disabled")===null)&&(!n.parentNode.disabled||!jQuery.nodeName(n.parentNode,"optgroup"))){t=jQuery(n).val();if(s)return t;o.push(t)}}return o},set:function(e,t){var n,r,i=e.options,s=jQuery.makeArray(t),o=i.length;while(o--){r=i[o];if(r.selected=jQuery.inArray(r.value,s)>=0)n=!0}return n||(e.selectedIndex=-1),s}}}}),jQuery.each(["radio","checkbox"],function(){jQuery.valHooks[this]={set:function(e,t){if(jQuery.isArray(t))return e.checked=jQuery.inArray(jQuery(e).val(),t)>=0}},support.checkOn||(jQuery.valHooks[this].get=function(e){return e.getAttribute("value")===null?"on":e.value})}),jQuery.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(e,t){jQuery.fn[t]=function(e,n){return arguments.length>0?this.on(t,null,e,n):this.trigger(t)}}),jQuery.fn.extend({hover:function(e,t){return this.mouseenter(e).mouseleave(t||e)},bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return arguments.length===1?this.off(e,"**"):this.off(t,e||"**",n)}});var nonce=jQuery.now(),rquery=/\?/;jQuery.parseJSON=function(e){return JSON.parse(e+"")},jQuery.parseXML=function(e){var t,n;if(!e||typeof e!="string")return null;try{n=new DOMParser,t=n.parseFromString(e,"text/xml")}catch(r){t=undefined}return(!t||t.getElementsByTagName("parsererror").length)&&jQuery.error("Invalid XML: "+e),t};var rhash=/#.*$/,rts=/([?&])_=[^&]*/,rheaders=/^(.*?):[ \t]*([^\r\n]*)$/mg,rlocalProtocol=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,rnoContent=/^(?:GET|HEAD)$/,rprotocol=/^\/\//,rurl=/^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,prefilters={},transports={},allTypes="*/".concat("*"),ajaxLocation=window.location.href,ajaxLocParts=rurl.exec(ajaxLocation.toLowerCase())||[];jQuery.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:ajaxLocation,type:"GET",isLocal:rlocalProtocol.test(ajaxLocParts[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":allTypes,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":jQuery.parseJSON,"text xml":jQuery.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(e,t){return t?ajaxExtend(ajaxExtend(e,jQuery.ajaxSettings),t):ajaxExtend(jQuery.ajaxSettings,e)},ajaxPrefilter:addToPrefiltersOrTransports(prefilters),ajaxTransport:addToPrefiltersOrTransports(transports),ajax:function(e,t){function S(e,t,s,u){var f,m,g,b,E,S=t;if(y===2)return;y=2,o&&clearTimeout(o),n=undefined,i=u||"",w.readyState=e>0?4:0,f=e>=200&&e<300||e===304,s&&(b=ajaxHandleResponses(l,w,s)),b=ajaxConvert(l,b,w,f);if(f)l.ifModified&&(E=w.getResponseHeader("Last-Modified"),E&&(jQuery.lastModified[r]=E),E=w.getResponseHeader("etag"),E&&(jQuery.etag[r]=E)),e===204||l.type==="HEAD"?S="nocontent":e===304?S="notmodified":(S=b.state,m=b.data,g=b.error,f=!g);else{g=S;if(e||!S)S="error",e<0&&(e=0)}w.status=e,w.statusText=(t||S)+"",f?p.resolveWith(c,[m,S,w]):p.rejectWith(c,[w,S,g]),w.statusCode(v),v=undefined,a&&h.trigger(f?"ajaxSuccess":"ajaxError",[w,l,f?m:g]),d.fireWith(c,[w,S]),a&&(h.trigger("ajaxComplete",[w,l]),--jQuery.active||jQuery.event.trigger("ajaxStop"))}typeof e=="object"&&(t=e,e=undefined),t=t||{};var n,r,i,s,o,u,a,f,l=jQuery.ajaxSetup({},t),c=l.context||l,h=l.context&&(c.nodeType||c.jquery)?jQuery(c):jQuery.event,p=jQuery.Deferred(),d=jQuery.Callbacks("once memory"),v=l.statusCode||{},m={},g={},y=0,b="canceled",w={readyState:0,getResponseHeader:function(e){var t;if(y===2){if(!s){s={};while(t=rheaders.exec(i))s[t[1].toLowerCase()]=t[2]}t=s[e.toLowerCase()]}return t==null?null:t},getAllResponseHeaders:function(){return y===2?i:null},setRequestHeader:function(e,t){var n=e.toLowerCase();return y||(e=g[n]=g[n]||e,m[e]=t),this},overrideMimeType:function(e){return y||(l.mimeType=e),this},statusCode:function(e){var t;if(e)if(y<2)for(t in e)v[t]=[v[t],e[t]];else w.always(e[w.status]);return this},abort:function(e){var t=e||b;return n&&n.abort(t),S(0,t),this}};p.promise(w).complete=d.add,w.success=w.done,w.error=w.fail,l.url=((e||l.url||ajaxLocation)+"").replace(rhash,"").replace(rprotocol,ajaxLocParts[1]+"//"),l.type=t.method||t.type||l.method||l.type,l.dataTypes=jQuery.trim(l.dataType||"*").toLowerCase().match(rnotwhite)||[""],l.crossDomain==null&&(u=rurl.exec(l.url.toLowerCase()),l.crossDomain=!(!u||u[1]===ajaxLocParts[1]&&u[2]===ajaxLocParts[2]&&(u[3]||(u[1]==="http:"?"80":"443"))===(ajaxLocParts[3]||(ajaxLocParts[1]==="http:"?"80":"443")))),l.data&&l.processData&&typeof l.data!="string"&&(l.data=jQuery.param(l.data,l.traditional)),inspectPrefiltersOrTransports(prefilters,l,t,w);if(y===2)return w;a=jQuery.event&&l.global,a&&jQuery.active++===0&&jQuery.event.trigger("ajaxStart"),l.type=l.type.toUpperCase(),l.hasContent=!rnoContent.test(l.type),r=l.url,l.hasContent||(l.data&&(r=l.url+=(rquery.test(r)?"&":"?")+l.data,delete l.data),l.cache===!1&&(l.url=rts.test(r)?r.replace(rts,"$1_="+nonce++):r+(rquery.test(r)?"&":"?")+"_="+nonce++)),l.ifModified&&(jQuery.lastModified[r]&&w.setRequestHeader("If-Modified-Since",jQuery.lastModified[r]),jQuery.etag[r]&&w.setRequestHeader("If-None-Match",jQuery.etag[r])),(l.data&&l.hasContent&&l.contentType!==!1||t.contentType)&&w.setRequestHeader("Content-Type",l.contentType),w.setRequestHeader("Accept",l.dataTypes[0]&&l.accepts[l.dataTypes[0]]?l.accepts[l.dataTypes[0]]+(l.dataTypes[0]!=="*"?", "+allTypes+"; q=0.01":""):l.accepts["*"]);for(f in l.headers)w.setRequestHeader(f,l.headers[f]);if(!l.beforeSend||l.beforeSend.call(c,w,l)!==!1&&y!==2){b="abort";for(f in{success:1,error:1,complete:1})w[f](l[f]);n=inspectPrefiltersOrTransports(transports,l,t,w);if(!n)S(-1,"No Transport");else{w.readyState=1,a&&h.trigger("ajaxSend",[w,l]),l.async&&l.timeout>0&&(o=setTimeout(function(){w.abort("timeout")},l.timeout));try{y=1,n.send(m,S)}catch(E){if(!(y<2))throw E;S(-1,E)}}return w}return w.abort()},getJSON:function(e,t,n){return jQuery.get(e,t,n,"json")},getScript:function(e,t){return jQuery.get(e,undefined,t,"script")}}),jQuery.each(["get","post"],function(e,t){jQuery[t]=function(e,n,r,i){return jQuery.isFunction(n)&&(i=i||r,r=n,n=undefined),jQuery.ajax({url:e,type:t,dataType:i,data:n,success:r})}}),jQuery._evalUrl=function(e){return jQuery.ajax({url:e,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})},jQuery.fn.extend({wrapAll:function(e){var t;return jQuery.isFunction(e)?this.each(function(t){jQuery(this).wrapAll(e.call(this,t))}):(this[0]&&(t=jQuery(e,this[0].ownerDocument).eq(0).clone(!0),this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstElementChild)e=e.firstElementChild;return e}).append(this)),this)},wrapInner:function(e){return jQuery.isFunction(e)?this.each(function(t){jQuery(this).wrapInner(e.call(this,t))}):this.each(function(){var t=jQuery(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=jQuery.isFunction(e);return this.each(function(n){jQuery(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(){return this.parent().each(function(){jQuery.nodeName(this,"body")||jQuery(this).replaceWith(this.childNodes)}).end()}}),jQuery.expr.filters.hidden=function(e){return e.offsetWidth<=0&&e.offsetHeight<=0},jQuery.expr.filters.visible=function(e){return!jQuery.expr.filters.hidden(e)};var r20=/%20/g,rbracket=/\[\]$/,rCRLF=/\r?\n/g,rsubmitterTypes=/^(?:submit|button|image|reset|file)$/i,rsubmittable=/^(?:input|select|textarea|keygen)/i;jQuery.param=function(e,t){var n,r=[],i=function(e,t){t=jQuery.isFunction(t)?t():t==null?"":t,r[r.length]=encodeURIComponent(e)+"="+encodeURIComponent(t)};t===undefined&&(t=jQuery.ajaxSettings&&jQuery.ajaxSettings.traditional);if(jQuery.isArray(e)||e.jquery&&!jQuery.isPlainObject(e))jQuery.each(e,function(){i(this.name,this.value)});else for(n in e)buildParams(n,e[n],t,i);return r.join("&").replace(r20,"+")},jQuery.fn.extend({serialize:function(){return jQuery.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var e=jQuery.prop(this,"elements");return e?jQuery.makeArray(e):this}).filter(function(){var e=this.type;return this.name&&!jQuery(this).is(":disabled")&&rsubmittable.test(this.nodeName)&&!rsubmitterTypes.test(e)&&(this.checked||!rcheckableType.test(e))}).map(function(e,t){var n=jQuery(this).val();return n==null?null:jQuery.isArray(n)?jQuery.map(n,function(e){return{name:t.name,value:e.replace(rCRLF,"\r\n")}}):{name:t.name,value:n.replace(rCRLF,"\r\n")}}).get()}}),jQuery.ajaxSettings.xhr=function(){try{return new XMLHttpRequest}catch(e){}};var xhrId=0,xhrCallbacks={},xhrSuccessStatus={0:200,1223:204},xhrSupported=jQuery.ajaxSettings.xhr();window.attachEvent&&window.attachEvent("onunload",function(){for(var e in xhrCallbacks)xhrCallbacks[e]()}),support.cors=!!xhrSupported&&"withCredentials"in xhrSupported,support.ajax=xhrSupported=!!xhrSupported,jQuery.ajaxTransport(function(e){var t;if(support.cors||xhrSupported&&!e.crossDomain)return{send:function(n,r){var i,s=e.xhr(),o=++xhrId;s.open(e.type,e.url,e.async,e.username,e.password);if(e.xhrFields)for(i in e.xhrFields)s[i]=e.xhrFields[i];e.mimeType&&s.overrideMimeType&&s.overrideMimeType(e.mimeType),!e.crossDomain&&!n["X-Requested-With"]&&(n["X-Requested-With"]="XMLHttpRequest");for(i in n)s.setRequestHeader(i,n[i]);t=function(e){return function(){t&&(delete xhrCallbacks[o],t=s.onload=s.onerror=null,e==="abort"?s.abort():e==="error"?r(s.status,s.statusText):r(xhrSuccessStatus[s.status]||s.status,s.statusText,typeof s.responseText=="string"?{text:s.responseText}:undefined,s.getAllResponseHeaders()))}},s.onload=t(),s.onerror=t("error"),t=xhrCallbacks[o]=t("abort");try{s.send(e.hasContent&&e.data||null)}catch(u){if(t)throw u}},abort:function(){t&&t()}}}),jQuery.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(e){return jQuery.globalEval(e),e}}}),jQuery.ajaxPrefilter("script",function(e){e.cache===undefined&&(e.cache=!1),e.crossDomain&&(e.type="GET")}),jQuery.ajaxTransport("script",function(e){if(e.crossDomain){var t,n;return{send:function(r,i){t=jQuery("<script>").prop({async:!0,charset:e.scriptCharset,src:e.url}).on("load error",n=function(e){t.remove(),n=null,e&&i(e.type==="error"?404:200,e.type)}),document.head.appendChild(t[0])},abort:function(){n&&n()}}}});var oldCallbacks=[],rjsonp=/(=)\?(?=&|$)|\?\?/;jQuery.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=oldCallbacks.pop()||jQuery.expando+"_"+nonce++;return this[e]=!0,e}}),jQuery.ajaxPrefilter("json jsonp",function(e,t,n){var r,i,s,o=e.jsonp!==!1&&(rjsonp.test(e.url)?"url":typeof e.data=="string"&&!(e.contentType||"").indexOf("application/x-www-form-urlencoded")&&rjsonp.test(e.data)&&"data");if(o||e.dataTypes[0]==="jsonp")return r=e.jsonpCallback=jQuery.isFunction(e.jsonpCallback)?e.jsonpCallback():e.jsonpCallback,o?e[o]=e[o].replace(rjsonp,"$1"+r):e.jsonp!==!1&&(e.url+=(rquery.test(e.url)?"&":"?")+e.jsonp+"="+r),e.converters["script json"]=function(){return s||jQuery.error(r+" was not called"),s[0]},e.dataTypes[0]="json",i=window[r],window[r]=function(){s=arguments},n.always(function(){window[r]=i,e[r]&&(e.jsonpCallback=t.jsonpCallback,oldCallbacks.push(r)),s&&jQuery.isFunction(i)&&i(s[0]),s=i=undefined}),"script"}),jQuery.parseHTML=function(e,t,n){if(!e||typeof e!="string")return null;typeof t=="boolean"&&(n=t,t=!1),t=t||document;var r=rsingleTag.exec(e),i=!n&&[];return r?[t.createElement(r[1])]:(r=jQuery.buildFragment([e],t,i),i&&i.length&&jQuery(i).remove(),jQuery.merge([],r.childNodes))};var _load=jQuery.fn.load;jQuery.fn.load=function(e,t,n){if(typeof e!="string"&&_load)return _load.apply(this,arguments);var r,i,s,o=this,u=e.indexOf(" ");return u>=0&&(r=jQuery.trim(e.slice(u)),e=e.slice(0,u)),jQuery.isFunction(t)?(n=t,t=undefined):t&&typeof t=="object"&&(i="POST"),o.length>0&&jQuery.ajax({url:e,type:i,dataType:"html",data:t}).done(function(e){s=arguments,o.html(r?jQuery("<div>").append(jQuery.parseHTML(e)).find(r):e)}).complete(n&&function(e,t){o.each(n,s||[e.responseText,t,e])}),this},jQuery.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(e,t){jQuery.fn[t]=function(e){return this.on(t,e)}}),jQuery.expr.filters.animated=function(e){return jQuery.grep(jQuery.timers,function(t){return e===t.elem}).length};var docElem=window.document.documentElement;jQuery.offset={setOffset:function(e,t,n){var r,i,s,o,u,a,f,l=jQuery.css(e,"position"),c=jQuery(e),h={};l==="static"&&(e.style.position="relative"),u=c.offset(),s=jQuery.css(e,"top"),a=jQuery.css(e,"left"),f=(l==="absolute"||l==="fixed")&&(s+a).indexOf("auto")>-1,f?(r=c.position(),o=r.top,i=r.left):(o=parseFloat(s)||0,i=parseFloat(a)||0),jQuery.isFunction(t)&&(t=t.call(e,n,u)),t.top!=null&&(h.top=t.top-u.top+o),t.left!=null&&(h.left=t.left-u.left+i),"using"in t?t.using.call(e,h):c.css(h)}},jQuery.fn.extend({offset:function(e){if(arguments.length)return e===undefined?this:this.each(function(t){jQuery.offset.setOffset(this,e,t)});var t,n,r=this[0],i={top:0,left:0},s=r&&r.ownerDocument;if(!s)return;return t=s.documentElement,jQuery.contains(t,r)?(typeof r.getBoundingClientRect!==strundefined&&(i=r.getBoundingClientRect()),n=getWindow(s),{top:i.top+n.pageYOffset-t.clientTop,left:i.left+n.pageXOffset-t.clientLeft}):i},position:function(){if(!this[0])return;var e,t,n=this[0],r={top:0,left:0};return jQuery.css(n,"position")==="fixed"?t=n.getBoundingClientRect():(e=this.offsetParent(),t=this.offset(),jQuery.nodeName(e[0],"html")||(r=e.offset()),r.top+=jQuery.css(e[0],"borderTopWidth",!0),r.left+=jQuery.css(e[0],"borderLeftWidth",!0)),{top:t.top-r.top-jQuery.css(n,"marginTop",!0),left:t.left-r.left-jQuery.css(n,"marginLeft",!0)}},offsetParent:function(){return this.map(function(){var e=this.offsetParent||docElem;while(e&&!jQuery.nodeName(e,"html")&&jQuery.css(e,"position")==="static")e=e.offsetParent;return e||docElem})}}),jQuery.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,t){var n="pageYOffset"===t;jQuery.fn[e]=function(r){return access(this,function(e,r,i){var s=getWindow(e);if(i===undefined)return s?s[t]:e[r];s?s.scrollTo(n?window.pageXOffset:i,n?i:window.pageYOffset):e[r]=i},e,r,arguments.length,null)}}),jQuery.each(["top","left"],function(e,t){jQuery.cssHooks[t]=addGetHookIf(support.pixelPosition,function(e,n){if(n)return n=curCSS(e,t),rnumnonpx.test(n)?jQuery(e).position()[t]+"px":n})}),jQuery.each({Height:"height",Width:"width"},function(e,t){jQuery.each({padding:"inner"+e,content:t,"":"outer"+e},function(n,r){jQuery.fn[r]=function(r,i){var s=arguments.length&&(n||typeof r!="boolean"),o=n||(r===!0||i===!0?"margin":"border");return access(this,function(t,n,r){var i;return jQuery.isWindow(t)?t.document.documentElement["client"+e]:t.nodeType===9?(i=t.documentElement,Math.max(t.body["scroll"+e],i["scroll"+e],t.body["offset"+e],i["offset"+e],i["client"+e])):r===undefined?jQuery.css(t,n,o):jQuery.style(t,n,r,o)},t,s?r:undefined,s,null)}})}),jQuery.fn.size=function(){return this.length},jQuery.fn.andSelf=jQuery.fn.addBack,typeof define=="function"&&define.amd&&define("jquery",[],function(){return jQuery});var _jQuery=window.jQuery,_$=window.$;return jQuery.noConflict=function(e){return window.$===jQuery&&(window.$=_$),e&&window.jQuery===jQuery&&(window.jQuery=_jQuery),jQuery},typeof noGlobal===strundefined&&(window.jQuery=window.$=jQuery),jQuery}),function(e){var t=typeof self=="object"&&self.self==self&&self||typeof global=="object"&&global.global==global&&global;if(typeof define=="function"&&define.amd)define("backbone",["underscore","jquery","exports"],function(n,r,i){t.Backbone=e(t,i,n,r)});else if(typeof exports!="undefined"){var n=require("underscore"),r;try{r=require("jquery")}catch(i){}e(t,exports,n,r)}else t.Backbone=e(t,{},t._,t.jQuery||t.Zepto||t.ender||t.$)}(function(e,t,n,r){var i=e.Backbone,s=Array.prototype.slice;t.VERSION="1.2.3",t.$=r,t.noConflict=function(){return e.Backbone=i,this},t.emulateHTTP=!1,t.emulateJSON=!1;var o=function(e,t,r){switch(e){case 1:return function(){return n[t](this[r])};case 2:return function(e){return n[t](this[r],e)};case 3:return function(e,i){return n[t](this[r],a(e,this),i)};case 4:return function(e,i,s){return n[t](this[r],a(e,this),i,s)};default:return function(){var e=s.call(arguments);return e.unshift(this[r]),n[t].apply(n,e)}}},u=function(e,t,r){n.each(t,function(t,i){n[i]&&(e.prototype[i]=o(t,i,r))})},a=function(e,t){return n.isFunction(e)?e:n.isObject(e)&&!t._isModel(e)?f(e):n.isString(e)?function(t){return t.get(e)}:e},f=function(e){var t=n.matches(e);return function(e){return t(e.attributes)}},l=t.Events={},c=/\s+/,h=function(e,t,r,i,s){var o=0,u;if(r&&typeof r=="object"){i!==void 0&&"context"in s&&s.context===void 0&&(s.context=i);for(u=n.keys(r);o<u.length;o++)t=h(e,t,u[o],r[u[o]],s)}else if(r&&c.test(r))for(u=r.split(c);o<u.length;o++)t=e(t,u[o],i,s);else t=e(t,r,i,s);return t};l.on=function(e,t,n){return p(this,e,t,n)};var p=function(e,t,n,r,i){e._events=h(d,e._events||{},t,n,{context:r,ctx:e,listening:i});if(i){var s=e._listeners||(e._listeners={});s[i.id]=i}return e};l.listenTo=function(e,t,r){if(!e)return this;var i=e._listenId||(e._listenId=n.uniqueId("l")),s=this._listeningTo||(this._listeningTo={}),o=s[i];if(!o){var u=this._listenId||(this._listenId=n.uniqueId("l"));o=s[i]={obj:e,objId:i,id:u,listeningTo:s,count:0}}return p(e,t,r,this,o),this};var d=function(e,t,n,r){if(n){var i=e[t]||(e[t]=[]),s=r.context,o=r.ctx,u=r.listening;u&&u.count++,i.push({callback:n,context:s,ctx:s||o,listening:u})}return e};l.off=function(e,t,n){return this._events?(this._events=h(v,this._events,e,t,{context:n,listeners:this._listeners}),this):this},l.stopListening=function(e,t,r){var i=this._listeningTo;if(!i)return this;var s=e?[e._listenId]:n.keys(i);for(var o=0;o<s.length;o++){var u=i[s[o]];if(!u)break;u.obj.off(t,r,this)}return n.isEmpty(i)&&(this._listeningTo=void 0),this};var v=function(e,t,r,i){if(!e)return;var s=0,o,u=i.context,a=i.listeners;if(!t&&!r&&!u){var f=n.keys(a);for(;s<f.length;s++)o=a[f[s]],delete a[o.id],delete o.listeningTo[o.objId];return}var l=t?[t]:n.keys(e);for(;s<l.length;s++){t=l[s];var c=e[t];if(!c)break;var h=[];for(var p=0;p<c.length;p++){var d=c[p];r&&r!==d.callback&&r!==d.callback._callback||u&&u!==d.context?h.push(d):(o=d.listening,o&&--o.count===0&&(delete a[o.id],delete o.listeningTo[o.objId]))}h.length?e[t]=h:delete e[t]}if(n.size(e))return e};l.once=function(e,t,r){var i=h(m,{},e,t,n.bind(this.off,this));return this.on(i,void 0,r)},l.listenToOnce=function(e,t,r){var i=h(m,{},t,r,n.bind(this.stopListening,this,e));return this.listenTo(e,i)};var m=function(e,t,r,i){if(r){var s=e[t]=n.once(function(){i(t,s),r.apply(this,arguments)});s._callback=r}return e};l.trigger=function(e){if(!this._events)return this;var t=Math.max(0,arguments.length-1),n=Array(t);for(var r=0;r<t;r++)n[r]=arguments[r+1];return h(g,this._events,e,void 0,n),this};var g=function(e,t,n,r){if(e){var i=e[t],s=e.all;i&&s&&(s=s.slice()),i&&y(i,r),s&&y(s,[t].concat(r))}return e},y=function(e,t){var n,r=-1,i=e.length,s=t[0],o=t[1],u=t[2];switch(t.length){case 0:while(++r<i)(n=e[r]).callback.call(n.ctx);return;case 1:while(++r<i)(n=e[r]).callback.call(n.ctx,s);return;case 2:while(++r<i)(n=e[r]).callback.call(n.ctx,s,o);return;case 3:while(++r<i)(n=e[r]).callback.call(n.ctx,s,o,u);return;default:while(++r<i)(n=e[r]).callback.apply(n.ctx,t);return}};l.bind=l.on,l.unbind=l.off,n.extend(t,l);var b=t.Model=function(e,t){var r=e||{};t||(t={}),this.cid=n.uniqueId(this.cidPrefix),this.attributes={},t.collection&&(this.collection=t.collection),t.parse&&(r=this.parse(r,t)||{}),r=n.defaults({},r,n.result(this,"defaults")),this.set(r,t),this.changed={},this.initialize.apply(this,arguments)};n.extend(b.prototype,l,{changed:null,validationError:null,idAttribute:"id",cidPrefix:"c",initialize:function(){},toJSON:function(e){return n.clone(this.attributes)},sync:function(){return t.sync.apply(this,arguments)},get:function(e){return this.attributes[e]},escape:function(e){return n.escape(this.get(e))},has:function(e){return this.get(e)!=null},matches:function(e){return!!n.iteratee(e,this)(this.attributes)},set:function(e,t,r){if(e==null)return this;var i;typeof e=="object"?(i=e,r=t):(i={})[e]=t,r||(r={});if(!this._validate(i,r))return!1;var s=r.unset,o=r.silent,u=[],a=this._changing;this._changing=!0,a||(this._previousAttributes=n.clone(this.attributes),this.changed={});var f=this.attributes,l=this.changed,c=this._previousAttributes;for(var h in i)t=i[h],n.isEqual(f[h],t)||u.push(h),n.isEqual(c[h],t)?delete l[h]:l[h]=t,s?delete f[h]:f[h]=t;this.id=this.get(this.idAttribute);if(!o){u.length&&(this._pending=r);for(var p=0;p<u.length;p++)this.trigger("change:"+u[p],this,f[u[p]],r)}if(a)return this;if(!o)while(this._pending)r=this._pending,this._pending=!1,this.trigger("change",this,r);return this._pending=!1,this._changing=!1,this},unset:function(e,t){return this.set(e,void 0,n.extend({},t,{unset:!0}))},clear:function(e){var t={};for(var r in this.attributes)t[r]=void 0;return this.set(t,n.extend({},e,{unset:!0}))},hasChanged:function(e){return e==null?!n.isEmpty(this.changed):n.has(this.changed,e)},changedAttributes:function(e){if(!e)return this.hasChanged()?n.clone(this.changed):!1;var t=this._changing?this._previousAttributes:this.attributes,r={};for(var i in e){var s=e[i];if(n.isEqual(t[i],s))continue;r[i]=s}return n.size(r)?r:!1},previous:function(e){return e==null||!this._previousAttributes?null:this._previousAttributes[e]},previousAttributes:function(){return n.clone(this._previousAttributes)},fetch:function(e){e=n.extend({parse:!0},e);var t=this,r=e.success;return e.success=function(n){var i=e.parse?t.parse(n,e):n;if(!t.set(i,e))return!1;r&&r.call(e.context,t,n,e),t.trigger("sync",t,n,e)},R(this,e),this.sync("read",this,e)},save:function(e,t,r){var i;e==null||typeof e=="object"?(i=e,r=t):(i={})[e]=t,r=n.extend({validate:!0,parse:!0},r);var s=r.wait;if(i&&!s){if(!this.set(i,r))return!1}else if(!this._validate(i,r))return!1;var o=this,u=r.success,a=this.attributes;r.success=function(e){o.attributes=a;var t=r.parse?o.parse(e,r):e;s&&(t=n.extend({},i,t));if(t&&!o.set(t,r))return!1;u&&u.call(r.context,o,e,r),o.trigger("sync",o,e,r)},R(this,r),i&&s&&(this.attributes=n.extend({},a,i));var f=this.isNew()?"create":r.patch?"patch":"update";f==="patch"&&!r.attrs&&(r.attrs=i);var l=this.sync(f,this,r);return this.attributes=a,l},destroy:function(e){e=e?n.clone(e):{};var t=this,r=e.success,i=e.wait,s=function(){t.stopListening(),t.trigger("destroy",t,t.collection,e)};e.success=function(n){i&&s(),r&&r.call(e.context,t,n,e),t.isNew()||t.trigger("sync",t,n,e)};var o=!1;return this.isNew()?n.defer(e.success):(R(this,e),o=this.sync("delete",this,e)),i||s(),o},url:function(){var e=n.result(this,"urlRoot")||n.result(this.collection,"url")||q();if(this.isNew())return e;var t=this.get(this.idAttribute);return e.replace(/[^\/]$/,"$&/")+encodeURIComponent(t)},parse:function(e,t){return e},clone:function(){return new this.constructor(this.attributes)},isNew:function(){return!this.has(this.idAttribute)},isValid:function(e){return this._validate({},n.defaults({validate:!0},e))},_validate:function(e,t){if(!t.validate||!this.validate)return!0;e=n.extend({},this.attributes,e);var r=this.validationError=this.validate(e,t)||null;return r?(this.trigger("invalid",this,r,n.extend(t,{validationError:r})),!1):!0}});var w={keys:1,values:1,pairs:1,invert:1,pick:0,omit:0,chain:1,isEmpty:1};u(b,w,"attributes");var E=t.Collection=function(e,t){t||(t={}),t.model&&(this.model=t.model),t.comparator!==void 0&&(this.comparator=t.comparator),this._reset(),this.initialize.apply(this,arguments),e&&this.reset(e,n.extend({silent:!0},t))},S={add:!0,remove:!0,merge:!0},x={add:!0,remove:!1},T=function(e,t,n){n=Math.min(Math.max(n,0),e.length);var r=Array(e.length-n),i=t.length;for(var s=0;s<r.length;s++)r[s]=e[s+n];for(s=0;s<i;s++)e[s+n]=t[s];for(s=0;s<r.length;s++)e[s+i+n]=r[s]};n.extend(E.prototype,l,{model:b,initialize:function(){},toJSON:function(e){return this.map(function(t){return t.toJSON(e)})},sync:function(){return t.sync.apply(this,arguments)},add:function(e,t){return this.set(e,n.extend({merge:!1},t,x))},remove:function(e,t){t=n.extend({},t);var r=!n.isArray(e);e=r?[e]:n.clone(e);var i=this._removeModels(e,t);return!t.silent&&i&&this.trigger("update",this,t),r?i[0]:i},set:function(e,t){if(e==null)return;t=n.defaults({},t,S),t.parse&&!this._isModel(e)&&(e=this.parse(e,t));var r=!n.isArray(e);e=r?[e]:e.slice();var i=t.at;i!=null&&(i=+i),i<0&&(i+=this.length+1);var s=[],o=[],u=[],a={},f=t.add,l=t.merge,c=t.remove,h=!1,p=this.comparator&&i==null&&t.sort!==!1,d=n.isString(this.comparator)?this.comparator:null,v;for(var m=0;m<e.length;m++){v=e[m];var g=this.get(v);if(g){if(l&&v!==g){var y=this._isModel(v)?v.attributes:v;t.parse&&(y=g.parse(y,t)),g.set(y,t),p&&!h&&(h=g.hasChanged(d))}a[g.cid]||(a[g.cid]=!0,s.push(g)),e[m]=g}else f&&(v=e[m]=this._prepareModel(v,t),v&&(o.push(v),this._addReference(v,t),a[v.cid]=!0,s.push(v)))}if(c){for(m=0;m<this.length;m++)v=this.models[m],a[v.cid]||u.push(v);u.length&&this._removeModels(u,t)}var b=!1,w=!p&&f&&c;s.length&&w?(b=this.length!=s.length||n.some(this.models,function(e,t){return e!==s[t]}),this.models.length=0,T(this.models,s,0),this.length=this.models.length):o.length&&(p&&(h=!0),T(this.models,o,i==null?this.length:i),this.length=this.models.length),h&&this.sort({silent:!0});if(!t.silent){for(m=0;m<o.length;m++)i!=null&&(t.index=i+m),v=o[m],v.trigger("add",v,this,t);(h||b)&&this.trigger("sort",this,t),(o.length||u.length)&&this.trigger("update",this,t)}return r?e[0]:e},reset:function(e,t){t=t?n.clone(t):{};for(var r=0;r<this.models.length;r++)this._removeReference(this.models[r],t);return t.previousModels=this.models,this._reset(),e=this.add(e,n.extend({silent:!0},t)),t.silent||this.trigger("reset",this,t),e},push:function(e,t){return this.add(e,n.extend({at:this.length},t))},pop:function(e){var t=this.at(this.length-1);return this.remove(t,e)},unshift:function(e,t){return this.add(e,n.extend({at:0},t))},shift:function(e){var t=this.at(0);return this.remove(t,e)},slice:function(){return s.apply(this.models,arguments)},get:function(e){if(e==null)return void 0;var t=this.modelId(this._isModel(e)?e.attributes:e);return this._byId[e]||this._byId[t]||this._byId[e.cid]},at:function(e){return e<0&&(e+=this.length),this.models[e]},where:function(e,t){return this[t?"find":"filter"](e)},findWhere:function(e){return this.where(e,!0)},sort:function(e){var t=this.comparator;if(!t)throw new Error("Cannot sort a set without a comparator");e||(e={});var r=t.length;return n.isFunction(t)&&(t=n.bind(t,this)),r===1||n.isString(t)?this.models=this.sortBy(t):this.models.sort(t),e.silent||this.trigger("sort",this,e),this},pluck:function(e){return n.invoke(this.models,"get",e)},fetch:function(e){e=n.extend({parse:!0},e);var t=e.success,r=this;return e.success=function(n){var i=e.reset?"reset":"set";r[i](n,e),t&&t.call(e.context,r,n,e),r.trigger("sync",r,n,e)},R(this,e),this.sync("read",this,e)},create:function(e,t){t=t?n.clone(t):{};var r=t.wait;e=this._prepareModel(e,t);if(!e)return!1;r||this.add(e,t);var i=this,s=t.success;return t.success=function(e,t,n){r&&i.add(e,n),s&&s.call(n.context,e,t,n)},e.save(null,t),e},parse:function(e,t){return e},clone:function(){return new this.constructor(this.models,{model:this.model,comparator:this.comparator})},modelId:function(e){return e[this.model.prototype.idAttribute||"id"]},_reset:function(){this.length=0,this.models=[],this._byId={}},_prepareModel:function(e,t){if(this._isModel(e))return e.collection||(e.collection=this),e;t=t?n.clone(t):{},t.collection=this;var r=new this.model(e,t);return r.validationError?(this.trigger("invalid",this,r.validationError,t),!1):r},_removeModels:function(e,t){var n=[];for(var r=0;r<e.length;r++){var i=this.get(e[r]);if(!i)continue;var s=this.indexOf(i);this.models.splice(s,1),this.length--,t.silent||(t.index=s,i.trigger("remove",i,this,t)),n.push(i),this._removeReference(i,t)}return n.length?n:!1},_isModel:function(e){return e instanceof b},_addReference:function(e,t){this._byId[e.cid]=e;var n=this.modelId(e.attributes);n!=null&&(this._byId[n]=e),e.on("all",this._onModelEvent,this)},_removeReference:function(e,t){delete this._byId[e.cid];var n=this.modelId(e.attributes);n!=null&&delete this._byId[n],this===e.collection&&delete e.collection,e.off("all",this._onModelEvent,this)},_onModelEvent:function(e,t,n,r){if((e==="add"||e==="remove")&&n!==this)return;e==="destroy"&&this.remove(t,r);if(e==="change"){var i=this.modelId(t.previousAttributes()),s=this.modelId(t.attributes);i!==s&&(i!=null&&delete this._byId[i],s!=null&&(this._byId[s]=t))}this.trigger.apply(this,arguments)}});var N={forEach:3,each:3,map:3,collect:3,reduce:4,foldl:4,inject:4,reduceRight:4,foldr:4,find:3,detect:3,filter:3,select:3,reject:3,every:3,all:3,some:3,any:3,include:3,includes:3,contains:3,invoke:0,max:3,min:3,toArray:1,size:1,first:3,head:3,take:3,initial:3,rest:3,tail:3,drop:3,last:3,without:0,difference:0,indexOf:3,shuffle:1,lastIndexOf:3,isEmpty:1,chain:1,sample:3,partition:3,groupBy:3,countBy:3,sortBy:3,indexBy:3};u(E,N,"models");var C=t.View=function(e){this.cid=n.uniqueId("view"),n.extend(this,n.pick(e,L)),this._ensureElement(),this.initialize.apply(this,arguments)},k=/^(\S+)\s*(.*)$/,L=["model","collection","el","id","attributes","className","tagName","events"];n.extend(C.prototype,l,{tagName:"div",$:function(e){return this.$el.find(e)},initialize:function(){},render:function(){return this},remove:function(){return this._removeElement(),this.stopListening(),this},_removeElement:function(){this.$el.remove()},setElement:function(e){return this.undelegateEvents(),this._setElement(e),this.delegateEvents(),this},_setElement:function(e){this.$el=e instanceof t.$?e:t.$(e),this.el=this.$el[0]},delegateEvents:function(e){e||(e=n.result(this,"events"));if(!e)return this;this.undelegateEvents();for(var t in e){var r=e[t];n.isFunction(r)||(r=this[r]);if(!r)continue;var i=t.match(k);this.delegate(i[1],i[2],n.bind(r,this))}return this},delegate:function(e,t,n){return this.$el.on(e+".delegateEvents"+this.cid,t,n),this},undelegateEvents:function(){return this.$el&&this.$el.off(".delegateEvents"+this.cid),this},undelegate:function(e,t,n){return this.$el.off(e+".delegateEvents"+this.cid,t,n),this},_createElement:function(e){return document.createElement(e)},_ensureElement:function(){if(!this.el){var e=n.extend({},n.result(this,"attributes"));this.id&&(e.id=n.result(this,"id")),this.className&&(e["class"]=n.result(this,"className")),this.setElement(this._createElement(n.result(this,"tagName"))),this._setAttributes(e)}else this.setElement(n.result(this,"el"))},_setAttributes:function(e){this.$el.attr(e)}}),t.sync=function(e,r,i){var s=A[e];n.defaults(i||(i={}),{emulateHTTP:t.emulateHTTP,emulateJSON:t.emulateJSON});var o={type:s,dataType:"json"};i.url||(o.url=n.result(r,"url")||q()),i.data==null&&r&&(e==="create"||e==="update"||e==="patch")&&(o.contentType="application/json",o.data=JSON.stringify(i.attrs||r.toJSON(i))),i.emulateJSON&&(o.contentType="application/x-www-form-urlencoded",o.data=o.data?{model:o.data}:{});if(i.emulateHTTP&&(s==="PUT"||s==="DELETE"||s==="PATCH")){o.type="POST",i.emulateJSON&&(o.data._method=s);var u=i.beforeSend;i.beforeSend=function(e){e.setRequestHeader("X-HTTP-Method-Override",s);if(u)return u.apply(this,arguments)}}o.type!=="GET"&&!i.emulateJSON&&(o.processData=!1);var a=i.error;i.error=function(e,t,n){i.textStatus=t,i.errorThrown=n,a&&a.call(i.context,e,t,n)};var f=i.xhr=t.ajax(n.extend(o,i));return r.trigger("request",r,f,i),f};var A={create:"POST",update:"PUT",patch:"PATCH","delete":"DELETE",read:"GET"};t.ajax=function(){return t.$.ajax.apply(t.$,arguments)};var O=t.Router=function(e){e||(e={}),e.routes&&(this.routes=e.routes),this._bindRoutes(),this.initialize.apply(this,arguments)},M=/\((.*?)\)/g,_=/(\(\?)?:\w+/g,D=/\*\w+/g,P=/[\-{}\[\]+?.,\\\^$|#\s]/g;n.extend(O.prototype,l,{initialize:function(){},route:function(e,r,i){n.isRegExp(e)||(e=this._routeToRegExp(e)),n.isFunction(r)&&(i=r,r=""),i||(i=this[r]);var s=this;return t.history.route(e,function(n){var o=s._extractParameters(e,n);s.execute(i,o,r)!==!1&&(s.trigger.apply(s,["route:"+r].concat(o)),s.trigger("route",r,o),t.history.trigger("route",s,r,o))}),this},execute:function(e,t,n){e&&e.apply(this,t)},navigate:function(e,n){return t.history.navigate(e,n),this},_bindRoutes:function(){if(!this.routes)return;this.routes=n.result(this,"routes");var e,t=n.keys(this.routes);while((e=t.pop())!=null)this.route(e,this.routes[e])},_routeToRegExp:function(e){return e=e.replace(P,"\\$&").replace(M,"(?:$1)?").replace(_,function(e,t){return t?e:"([^/?]+)"}).replace(D,"([^?]*?)"),new RegExp("^"+e+"(?:\\?([\\s\\S]*))?$")},_extractParameters:function(e,t){var r=e.exec(t).slice(1);return n.map(r,function(e,t){return t===r.length-1?e||null:e?decodeURIComponent(e):null})}});var H=t.History=function(){this.handlers=[],this.checkUrl=n.bind(this.checkUrl,this),typeof window!="undefined"&&(this.location=window.location,this.history=window.history)},B=/^[#\/]|\s+$/g,j=/^\/+|\/+$/g,F=/#.*$/;H.started=!1,n.extend(H.prototype,l,{interval:50,atRoot:function(){var e=this.location.pathname.replace(/[^\/]$/,"$&/");return e===this.root&&!this.getSearch()},matchRoot:function(){var e=this.decodeFragment(this.location.pathname),t=e.slice(0,this.root.length-1)+"/";return t===this.root},decodeFragment:function(e){return decodeURI(e.replace(/%25/g,"%2525"))},getSearch:function(){var e=this.location.href.replace(/#.*/,"").match(/\?.+/);return e?e[0]:""},getHash:function(e){var t=(e||this).location.href.match(/#(.*)$/);return t?t[1]:""},getPath:function(){var e=this.decodeFragment(this.location.pathname+this.getSearch()).slice(this.root.length-1);return e.charAt(0)==="/"?e.slice(1):e},getFragment:function(e){return e==null&&(this._usePushState||!this._wantsHashChange?e=this.getPath():e=this.getHash()),e.replace(B,"")},start:function(e){if(H.started)throw new Error("Backbone.history has already been started");H.started=!0,this.options=n.extend({root:"/"},this.options,e),this.root=this.options.root,this._wantsHashChange=this.options.hashChange!==!1,this._hasHashChange="onhashchange"in window&&(document.documentMode===void 0||document.documentMode>7),this._useHashChange=this._wantsHashChange&&this._hasHashChange,this._wantsPushState=!!this.options.pushState,this._hasPushState=!!this.history&&!!this.history.pushState,this._usePushState=this._wantsPushState&&this._hasPushState,this.fragment=this.getFragment(),this.root=("/"+this.root+"/").replace(j,"/");if(this._wantsHashChange&&this._wantsPushState){if(!this._hasPushState&&!this.atRoot()){var t=this.root.slice(0,-1)||"/";return this.location.replace(t+"#"+this.getPath()),!0}this._hasPushState&&this.atRoot()&&this.navigate(this.getHash(),{replace:!0})}if(!this._hasHashChange&&this._wantsHashChange&&!this._usePushState){this.iframe=document.createElement("iframe"),this.iframe.src="javascript:0",this.iframe.style.display="none",this.iframe.tabIndex=-1;var r=document.body,i=r.insertBefore(this.iframe,r.firstChild).contentWindow;i.document.open(),i.document.close(),i.location.hash="#"+this.fragment}var s=window.addEventListener||function(e,t){return attachEvent("on"+e,t)};this._usePushState?s("popstate",this.checkUrl,!1):this._useHashChange&&!this.iframe?s("hashchange",this.checkUrl,!1):this._wantsHashChange&&(this._checkUrlInterval=setInterval(this.checkUrl,this.interval));if(!this.options.silent)return this.loadUrl()},stop:function(){var e=window.removeEventListener||function(e,t){return detachEvent("on"+e,t)};this._usePushState?e("popstate",this.checkUrl,!1):this._useHashChange&&!this.iframe&&e("hashchange",this.checkUrl,!1),this.iframe&&(document.body.removeChild(this.iframe),this.iframe=null),this._checkUrlInterval&&clearInterval(this._checkUrlInterval),H.started=!1},route:function(e,t){this.handlers.unshift({route:e,callback:t})},checkUrl:function(e){var t=this.getFragment();t===this.fragment&&this.iframe&&(t=this.getHash(this.iframe.contentWindow));if(t===this.fragment)return!1;this.iframe&&this.navigate(t),this.loadUrl()},loadUrl:function(e){return this.matchRoot()?(e=this.fragment=this.getFragment(e),n.some(this.handlers,function(t){if(t.route.test(e))return t.callback(e),!0})):!1},navigate:function(e,t){if(!H.started)return!1;if(!t||t===!0)t={trigger:!!t};e=this.getFragment(e||"");var n=this.root;if(e===""||e.charAt(0)==="?")n=n.slice(0,-1)||"/";var r=n+e;e=this.decodeFragment(e.replace(F,""));if(this.fragment===e)return;this.fragment=e;if(this._usePushState)this.history[t.replace?"replaceState":"pushState"]({},document.title,r);else{if(!this._wantsHashChange)return this.location.assign(r);this._updateHash(this.location,e,t.replace);if(this.iframe&&e!==this.getHash(this.iframe.contentWindow)){var i=this.iframe.contentWindow;t.replace||(i.document.open(),i.document.close()),this._updateHash(i.location,e,t.replace)}}if(t.trigger)return this.loadUrl(e)},_updateHash:function(e,t,n){if(n){var r=e.href.replace(/(javascript:|#).*$/,"");e.replace(r+"#"+t)}else e.hash="#"+t}}),t.history=new H;var I=function(e,t){var r=this,i;e&&n.has(e,"constructor")?i=e.constructor:i=function(){return r.apply(this,arguments)},n.extend(i,r,t);var s=function(){this.constructor=i};return s.prototype=r.prototype,i.prototype=new s,e&&n.extend(i.prototype,e),i.__super__=r.prototype,i};b.extend=E.extend=O.extend=C.extend=H.extend=I;var q=function(){throw new Error('A "url" property or function must be specified')},R=function(e,t){var n=t.error;t.error=function(r){n&&n.call(t.context,e,r,t),e.trigger("error",e,r,t)}};return t}),function(e,t){if(typeof define=="function"&&define.amd)define("backbone.wreqr",["backbone","underscore"],function(e,n){return t(e,n)});else if(typeof exports!="undefined"){var n=require("backbone"),r=require("underscore");module.exports=t(n,r)}else t(e.Backbone,e._)}(this,function(e,t){"use strict";var n=e.Wreqr,r=e.Wreqr={};return e.Wreqr.VERSION="1.3.5",e.Wreqr.noConflict=function(){return e.Wreqr=n,this},r.Handlers=function(e,t){var n=function(e){this.options=e,this._wreqrHandlers={},t.isFunction(this.initialize)&&this.initialize(e)};return n.extend=e.Model.extend,t.extend(n.prototype,e.Events,{setHandlers:function(e){t.each(e,function(e,n){var r=null;t.isObject(e)&&!t.isFunction(e)&&(r=e.context,e=e.callback),this.setHandler(n,e,r)},this)},setHandler:function(e,t,n){var r={callback:t,context:n};this._wreqrHandlers[e]=r,this.trigger("handler:add",e,t,n)},hasHandler:function(e){return!!this._wreqrHandlers[e]},getHandler:function(e){var t=this._wreqrHandlers[e];if(!t)return;return function(){return t.callback.apply(t.context,arguments)}},removeHandler:function(e){delete this._wreqrHandlers[e]},removeAllHandlers:function(){this._wreqrHandlers={}}}),n}(e,t),r.CommandStorage=function(){var n=function(e){this.options=e,this._commands={},t.isFunction(this.initialize)&&this.initialize(e)};return t.extend(n.prototype,e.Events,{getCommands:function(e){var t=this._commands[e];return t||(t={command:e,instances:[]},this._commands[e]=t),t},addCommand:function(e,t){var n=this.getCommands(e);n.instances.push(t)},clearCommands:function(e){var t=this.getCommands(e);t.instances=[]}}),n}(),r.Commands=function(e,t){return e.Handlers.extend({storageType:e.CommandStorage,constructor:function(t){this.options=t||{},this._initializeStorage(this.options),this.on("handler:add",this._executeCommands,this),e.Handlers.prototype.constructor.apply(this,arguments)},execute:function(e){e=arguments[0];var n=t.rest(arguments);this.hasHandler(e)?this.getHandler(e).apply(this,n):this.storage.addCommand(e,n)},_executeCommands:function(e,n,r){var i=this.storage.getCommands(e);t.each(i.instances,function(e){n.apply(r,e)}),this.storage.clearCommands(e)},_initializeStorage:function(e){var n,r=e.storageType||this.storageType;t.isFunction(r)?n=new r:n=r,this.storage=n}})}(r,t),r.RequestResponse=function(e,t){return e.Handlers.extend({request:function(e){if(this.hasHandler(e))return this.getHandler(e).apply(this,t.rest(arguments))}})}(r,t),r.EventAggregator=function(e,t){var n=function(){};return n.extend=e.Model.extend,t.extend(n.prototype,e.Events),n}(e,t),r.Channel=function(n){var r=function(t){this.vent=new e.Wreqr.EventAggregator,this.reqres=new e.Wreqr.RequestResponse,this.commands=new e.Wreqr.Commands,this.channelName=t};return t.extend(r.prototype,{reset:function(){return this.vent.off(),this.vent.stopListening(),this.reqres.removeAllHandlers(),this.commands.removeAllHandlers(),this},connectEvents:function(e,t){return this._connect("vent",e,t),this},connectCommands:function(e,t){return this._connect("commands",e,t),this},connectRequests:function(e,t){return this._connect("reqres",e,t),this},_connect:function(e,n,r){if(!n)return;r=r||this;var i=e==="vent"?"on":"setHandler";t.each(n,function(n,s){this[e][i](s,t.bind(n,r))},this)}}),r}(r),r.radio=function(e,t){var n=function(){this._channels={},this.vent={},this.commands={},this.reqres={},this._proxyMethods()};t.extend(n.prototype,{channel:function(e){if(!e)throw new Error("Channel must receive a name");return this._getChannel(e)},_getChannel:function(t){var n=this._channels[t];return n||(n=new e.Channel(t),this._channels[t]=n),n},_proxyMethods:function(){t.each(["vent","commands","reqres"],function(e){t.each(r[e],function(t){this[e][t]=i(this,e,t)},this)},this)}});var r={vent:["on","off","trigger","once","stopListening","listenTo","listenToOnce"],commands:["execute","setHandler","setHandlers","removeHandler","removeAllHandlers"],reqres:["request","setHandler","setHandlers","removeHandler","removeAllHandlers"]},i=function(e,n,r){return function(i){var s=e._getChannel(i)[n];return s[r].apply(s,t.rest(arguments))}};return new n}(r,t),e.Wreqr}),function(e,t){if(typeof define=="function"&&define.amd)define("backbone.babysitter",["backbone","underscore"],function(e,n){return t(e,n)});else if(typeof exports!="undefined"){var n=require("backbone"),r=require("underscore");module.exports=t(n,r)}else t(e.Backbone,e._)}(this,function(e,t){"use strict";var n=e.ChildViewContainer;return e.ChildViewContainer=function(e,t){var n=function(e){this._views={},this._indexByModel={},this._indexByCustom={},this._updateLength(),t.each(e,this.add,this)};t.extend(n.prototype,{add:function(e,t){var n=e.cid;return this._views[n]=e,e.model&&(this._indexByModel[e.model.cid]=n),t&&(this._indexByCustom[t]=n),this._updateLength(),this},findByModel:function(e){return this.findByModelCid(e.cid)},findByModelCid:function(e){var t=this._indexByModel[e];return this.findByCid(t)},findByCustom:function(e){var t=this._indexByCustom[e];return this.findByCid(t)},findByIndex:function(e){return t.values(this._views)[e]},findByCid:function(e){return this._views[e]},remove:function(e){var n=e.cid;return e.model&&delete this._indexByModel[e.model.cid],t.any(this._indexByCustom,function(e,t){if(e===n)return delete this._indexByCustom[t],!0},this),delete this._views[n],this._updateLength(),this},call:function(e){this.apply(e,t.tail(arguments))},apply:function(e,n){t.each(this._views,function(r){t.isFunction(r[e])&&r[e].apply(r,n||[])})},_updateLength:function(){this.length=t.size(this._views)}});var r=["forEach","each","map","find","detect","filter","select","reject","every","all","some","any","include","contains","invoke","toArray","first","initial","rest","last","without","isEmpty","pluck","reduce"];return t.each(r,function(e){n.prototype[e]=function(){var n=t.values(this._views),r=[n].concat(t.toArray(arguments));return t[e].apply(t,r)}}),n}(e,t),e.ChildViewContainer.VERSION="0.1.10",e.ChildViewContainer.noConflict=function(){return e.ChildViewContainer=n,this},e.ChildViewContainer}),function(e,t){if(typeof define=="function"&&define.amd)define("marionette",["backbone","underscore","backbone.wreqr","backbone.babysitter"],function(n,r){return e.Marionette=e.Mn=t(e,n,r)});else if(typeof exports!="undefined"){var n=require("backbone"),r=require("underscore"),i=require("backbone.wreqr"),s=require("backbone.babysitter");module.exports=t(e,n,r)}else e.Marionette=e.Mn=t(e,e.Backbone,e._)}(this,function(e,t,n){"use strict";var r=e.Marionette,i=e.Mn,s=t.Marionette={};s.VERSION="2.4.3",s.noConflict=function(){return e.Marionette=r,e.Mn=i,this},s.Deferred=t.$.Deferred,s.FEATURES={},s.isEnabled=function(e){return!!s.FEATURES[e]},s.extend=t.Model.extend,s.isNodeAttached=function(e){return t.$.contains(document.documentElement,e)},s.mergeOptions=function(e,t){if(!e)return;n.extend(this,n.pick(e,t))},s.getOption=function(e,t){if(!e||!t)return;return e.options&&e.options[t]!==undefined?e.options[t]:e[t]},s.proxyGetOption=function(e){return s.getOption(this,e)},s._getValue=function(e,t,r){return n.isFunction(e)&&(e=r?e.apply(t,r):e.call(t)),e},s.normalizeMethods=function(e){return n.reduce(e,function(e,t,r){return n.isFunction(t)||(t=this[t]),t&&(e[r]=t),e},{},this)},s.normalizeUIString=function(e,t){return e.replace(/@ui\.[a-zA-Z_$0-9]*/g,function(e){return t[e.slice(4)]})},s.normalizeUIKeys=function(e,t){return n.reduce(e,function(e,n,r){var i=s.normalizeUIString(r,t);return e[i]=n,e},{})},s.normalizeUIValues=function(e,t,r){return n.each(e,function(i,o){n.isString(i)?e[o]=s.normalizeUIString(i,t):n.isObject(i)&&n.isArray(r)&&(n.extend(i,s.normalizeUIValues(n.pick(i,r),t)),n.each(r,function(e){var r=i[e];n.isString(r)&&(i[e]=s.normalizeUIString(r,t))}))}),e},s.actAsCollection=function(e,t){var r=["forEach","each","map","find","detect","filter","select","reject","every","all","some","any","include","contains","invoke","toArray","first","initial","rest","last","without","isEmpty","pluck"];n.each(r,function(r){e[r]=function(){var e=n.values(n.result(this,t)),i=[e].concat(n.toArray(arguments));return n[r].apply(n,i)}})};var o=s.deprecate=function(e,t){n.isObject(e)&&(e=e.prev+" is going to be removed in the future. "+"Please use "+e.next+" instead."+(e.url?" See: "+e.url:"")),(t===undefined||!t)&&!o._cache[e]&&(o._warn("Deprecation warning: "+e),o._cache[e]=!0)};o._warn=typeof console!="undefined"&&(console.warn||console.log)||function(){},o._cache={},s._triggerMethod=function(){function t(e,t,n){return n.toUpperCase()}var e=/(^|:)(\w)/gi;return function(r,i,s){var o=arguments.length<3;o&&(s=i,i=s[0]);var u="on"+i.replace(e,t),a=r[u],f;return n.isFunction(a)&&(f=a.apply(r,o?n.rest(s):s)),n.isFunction(r.trigger)&&(o+s.length>1?r.trigger.apply(r,o?s:[i].concat(n.drop(s,0))):r.trigger(i)),f}}(),s.triggerMethod=function(e){return s._triggerMethod(this,arguments)},s.triggerMethodOn=function(e){var t=n.isFunction(e.triggerMethod)?e.triggerMethod:s.triggerMethod;return t.apply(e,n.rest(arguments))},s.MonitorDOMRefresh=function(e){function t(){e._isShown=!0,r()}function n(){e._isRendered=!0,r()}function r(){e._isShown&&e._isRendered&&s.isNodeAttached(e.el)&&s.triggerMethodOn(e,"dom:refresh",e)}if(e._isDomRefreshMonitored)return;e._isDomRefreshMonitored=!0,e.on({show:t,render:n})},function(e){function t(t,r,i,s){var o=s.split(/\s+/);n.each(o,function(n){var s=t[n];if(!s)throw new e.Error('Method "'+n+'" was configured as an event handler, but does not exist.');t.listenTo(r,i,s)})}function r(e,t,n,r){e.listenTo(t,n,r)}function i(e,t,r,i){var s=i.split(/\s+/);n.each(s,function(n){var i=e[n];e.stopListening(t,r,i)})}function s(e,t,n,r){e.stopListening(t,n,r)}function o(t,r,i,s,o){if(!r||!i)return;if(!n.isObject(i))throw new e.Error({message:"Bindings must be an object or function.",url:"marionette.functions.html#marionettebindentityevents"});i=e._getValue(i,t),n.each(i,function(e,i){n.isFunction(e)?s(t,r,i,e):o(t,r,i,e)})}e.bindEntityEvents=function(e,n,i){o(e,n,i,r,t)},e.unbindEntityEvents=function(e,t,n){o(e,t,n,s,i)},e.proxyBindEntityEvents=function(t,n){return e.bindEntityEvents(this,t,n)},e.proxyUnbindEntityEvents=function(t,n){return e.unbindEntityEvents(this,t,n)}}(s);var u=["description","fileName","lineNumber","name","message","number"];return s.Error=s.extend.call(Error,{urlRoot:"http://marionettejs.com/docs/v"+s.VERSION+"/",constructor:function(e,t){n.isObject(e)?(t=e,e=t.message):t||(t={});var r=Error.call(this,e);n.extend(this,n.pick(r,u),n.pick(t,u)),this.captureStackTrace(),t.url&&(this.url=this.urlRoot+t.url)},captureStackTrace:function(){Error.captureStackTrace&&Error.captureStackTrace(this,s.Error)},toString:function(){return this.name+": "+this.message+(this.url?" See: "+this.url:"")}}),s.Error.extend=s.extend,s.Callbacks=function(){this._deferred=s.Deferred(),this._callbacks=[]},n.extend(s.Callbacks.prototype,{add:function(e,t){var r=n.result(this._deferred,"promise");this._callbacks.push({cb:e,ctx:t}),r.then(function(n){t&&(n.context=t),e.call(n.context,n.options)})},run:function(e,t){this._deferred.resolve({options:e,context:t})},reset:function(){var e=this._callbacks;this._deferred=s.Deferred(),this._callbacks=[],n.each(e,function(e){this.add(e.cb,e.ctx)},this)}}),s.Controller=function(e){this.options=e||{},n.isFunction(this.initialize)&&this.initialize(this.options)},s.Controller.extend=s.extend,n.extend(s.Controller.prototype,t.Events,{destroy:function(){return s._triggerMethod(this,"before:destroy",arguments),s._triggerMethod(this,"destroy",arguments),this.stopListening(),this.off(),this},triggerMethod:s.triggerMethod,mergeOptions:s.mergeOptions,getOption:s.proxyGetOption}),s.Object=function(e){this.options=n.extend({},n.result(this,"options"),e),this.initialize.apply(this,arguments)},s.Object.extend=s.extend,n.extend(s.Object.prototype,t.Events,{initialize:function(){},destroy:function(){return this.triggerMethod("before:destroy"),this.triggerMethod("destroy"),this.stopListening(),this},triggerMethod:s.triggerMethod,mergeOptions:s.mergeOptions,getOption:s.proxyGetOption,bindEntityEvents:s.proxyBindEntityEvents,unbindEntityEvents:s.proxyUnbindEntityEvents}),s.Region=s.Object.extend({constructor:function(e){this.options=e||{},this.el=this.getOption("el"),this.el=this.el instanceof t.$?this.el[0]:this.el;if(!this.el)throw new s.Error({name:"NoElError",message:'An "el" must be specified for a region.'});this.$el=this.getEl(this.el),s.Object.call(this,e)},show:function(e,t){if(!this._ensureElement())return;this._ensureViewIsIntact(e),s.MonitorDOMRefresh(e);var r=t||{},i=e!==this.currentView,o=!!r.preventDestroy,u=!!r.forceShow,a=!!this.currentView,f=i&&!o,l=i||u;a&&this.triggerMethod("before:swapOut",this.currentView,this,t),this.currentView&&delete this.currentView._parent,f?this.empty():a&&l&&this.currentView.off("destroy",this.empty,this);if(l){e.once("destroy",this.empty,this),this._renderView(e),e._parent=this,a&&this.triggerMethod("before:swap",e,this,t),this.triggerMethod("before:show",e,this,t),s.triggerMethodOn(e,"before:show",e,this,t),a&&this.triggerMethod("swapOut",this.currentView,this,t);var c=s.isNodeAttached(this.el),h=[],p=n.extend({triggerBeforeAttach:this.triggerBeforeAttach,triggerAttach:this.triggerAttach},r);return c&&p.triggerBeforeAttach&&(h=this._displayedViews(e),this._triggerAttach(h,"before:")),this.attachHtml(e),this.currentView=e,c&&p.triggerAttach&&(h=this._displayedViews(e),this._triggerAttach(h)),a&&this.triggerMethod("swap",e,this,t),this.triggerMethod("show",e,this,t),s.triggerMethodOn(e,"show",e,this,t),this}return this},triggerBeforeAttach:!0,triggerAttach:!0,_triggerAttach:function(e,t){var r=(t||"")+"attach";n.each(e,function(e){s.triggerMethodOn(e,r,e,this)},this)},_displayedViews:function(e){return n.union([e],n.result(e,"_getNestedViews")||[])},_renderView:function(e){e.supportsRenderLifecycle||s.triggerMethodOn(e,"before:render",e),e.render(),e.supportsRenderLifecycle||s.triggerMethodOn(e,"render",e)},_ensureElement:function(){n.isObject(this.el)||(this.$el=this.getEl(this.el),this.el=this.$el[0]);if(!this.$el||this.$el.length===0){if(this.getOption("allowMissingEl"))return!1;throw new s.Error('An "el" '+this.$el.selector+" must exist in DOM")}return!0},_ensureViewIsIntact:function(e){if(!e)throw new s.Error({name:"ViewNotValid",message:"The view passed is undefined and therefore invalid. You must pass a view instance to show."});if(e.isDestroyed)throw new s.Error({name:"ViewDestroyedError",message:'View (cid: "'+e.cid+'") has already been destroyed and cannot be used.'})},getEl:function(e){return t.$(e,s._getValue(this.options.parentEl,this))},attachHtml:function(e){this.$el.contents().detach(),this.el.appendChild(e.el)},empty:function(e){var t=this.currentView,n=e||{},r=!!n.preventDestroy;if(!t)return;return t.off("destroy",this.empty,this),this.triggerMethod("before:empty",t),r||this._destroyView(),this.triggerMethod("empty",t),delete this.currentView,r&&this.$el.contents().detach(),this},_destroyView:function(){var e=this.currentView;if(e.isDestroyed)return;e.supportsDestroyLifecycle||s.triggerMethodOn(e,"before:destroy",e),e.destroy?e.destroy():(e.remove(),e.isDestroyed=!0),e.supportsDestroyLifecycle||s.triggerMethodOn(e,"destroy",e)},attachView:function(e){return this.currentView&&delete this.currentView._parent,e._parent=this,this.currentView=e,this},hasView:function(){return!!this.currentView},reset:function(){return this.empty(),this.$el&&(this.el=this.$el.selector),delete this.$el,this}},{buildRegion:function(e,t){if(n.isString(e))return this._buildRegionFromSelector(e,t);if(e.selector||e.el||e.regionClass)return this._buildRegionFromObject(e,t);if(n.isFunction(e))return this._buildRegionFromRegionClass(e);throw new s.Error({message:"Improper region configuration type.",url:"marionette.region.html#region-configuration-types"})},_buildRegionFromSelector:function(e,t){return new t({el:e})},_buildRegionFromObject:function(e,t){var r=e.regionClass||t,i=n.omit(e,"selector","regionClass");return e.selector&&!i.el&&(i.el=e.selector),new r(i)},_buildRegionFromRegionClass:function(e){return new e}}),s.RegionManager=s.Controller.extend({constructor:function(e){this._regions={},this.length=0,s.Controller.call(this,e),this.addRegions(this.getOption("regions"))},addRegions:function(e,t){return e=s._getValue(e,this,arguments),n.reduce(e,function(e,r,i){return n.isString(r)&&(r={selector:r}),r.selector&&(r=n.defaults({},r,t)),e[i]=this.addRegion(i,r),e},{},this)},addRegion:function(e,t){var n;return t instanceof s.Region?n=t:n=s.Region.buildRegion(t,s.Region),this.triggerMethod("before:add:region",e,n),n._parent=this,this._store(e,n),this.triggerMethod("add:region",e,n),n},get:function(e){return this._regions[e]},getRegions:function(){return n.clone(this._regions)},removeRegion:function(e){var t=this._regions[e];return this._remove(e,t),t},removeRegions:function(){var e=this.getRegions();return n.each(this._regions,function(e,t){this._remove(t,e)},this),e},emptyRegions:function(){var e=this.getRegions();return n.invoke(e,"empty"),e},destroy:function(){return this.removeRegions(),s.Controller.prototype.destroy.apply(this,arguments)},_store:function(e,t){this._regions[e]||this.length++,this._regions[e]=t},_remove:function(e,t){this.triggerMethod("before:remove:region",e,t),t.empty(),t.stopListening(),delete t._parent,delete this._regions[e],this.length--,this.triggerMethod("remove:region",e,t)}}),s.actAsCollection(s.RegionManager.prototype,"_regions"),s.TemplateCache=function(e){this.templateId=e},n.extend(s.TemplateCache,{templateCaches:{},get:function(e,t){var n=this.templateCaches[e];return n||(n=new s.TemplateCache(e),this.templateCaches[e]=n),n.load(t)},clear:function(){var e,t=n.toArray(arguments),r=t.length;if(r>0)for(e=0;e<r;e++)delete this.templateCaches[t[e]];else this.templateCaches={}}}),n.extend(s.TemplateCache.prototype,{load:function(e){if(this.compiledTemplate)return this.compiledTemplate;var t=this.loadTemplate(this.templateId,e);return this.compiledTemplate=this.compileTemplate(t,e),this.compiledTemplate},loadTemplate:function(e,n){var r=t.$(e);if(!r.length)throw new s.Error({name:"NoTemplateError",message:'Could not find template: "'+e+'"'});return r.html()},compileTemplate:function(e,t){return n.template(e,t)}}),s.Renderer={render:function(e,t){if(!e)throw new s.Error({name:"TemplateNotFoundError",message:"Cannot render the template since its false, null or undefined."});var r=n.isFunction(e)?e:s.TemplateCache.get(e);return r(t)}},s.View=t.View.extend({isDestroyed:!1,supportsRenderLifecycle:!0,supportsDestroyLifecycle:!0,constructor:function(e){this.render=n.bind(this.render,this),e=s._getValue(e,this),this.options=n.extend({},n.result(this,"options"),e),this._behaviors=s.Behaviors(this),t.View.call(this,this.options),s.MonitorDOMRefresh(this)},getTemplate:function(){return this.getOption("template")},serializeModel:function(e){return e.toJSON.apply(e,n.rest(arguments))},mixinTemplateHelpers:function(e){e=e||{};var t=this.getOption("templateHelpers");return t=s._getValue(t,this),n.extend(e,t)},normalizeUIKeys:function(e){var t=n.result(this,"_uiBindings");return s.normalizeUIKeys(e,t||n.result(this,"ui"))},normalizeUIValues:function(e,t){var r=n.result(this,"ui"),i=n.result(this,"_uiBindings");return s.normalizeUIValues(e,i||r,t)},configureTriggers:function(){if(!this.triggers)return;var e=this.normalizeUIKeys(n.result(this,"triggers"));return n.reduce(e,function(e,t,n){return e[n]=this._buildViewTrigger(t),e},{},this)},delegateEvents:function(e){return this._delegateDOMEvents(e),this.bindEntityEvents(this.model,this.getOption("modelEvents")),this.bindEntityEvents(this.collection,this.getOption("collectionEvents")),n.each(this._behaviors,function(e){e.bindEntityEvents(this.model,e.getOption("modelEvents")),e.bindEntityEvents(this.collection,e.getOption("collectionEvents"))},this),this},_delegateDOMEvents:function(e){var r=s._getValue(e||this.events,this);r=this.normalizeUIKeys(r),n.isUndefined(e)&&(this.events=r);var i={},o=n.result(this,"behaviorEvents")||{},u=this.configureTriggers(),a=n.result(this,"behaviorTriggers")||{};n.extend(i,o,r,u,a),t.View.prototype.delegateEvents.call(this,i)},undelegateEvents:function(){return t.View.prototype.undelegateEvents.apply(this,arguments),this.unbindEntityEvents(this.model,this.getOption("modelEvents")),this.unbindEntityEvents(this.collection,this.getOption("collectionEvents")),n.each(this._behaviors,function(e){e.unbindEntityEvents(this.model,e.getOption("modelEvents")),e.unbindEntityEvents(this.collection,e.getOption("collectionEvents"))},this),this},_ensureViewIsIntact:function(){if(this.isDestroyed)throw new s.Error({name:"ViewDestroyedError",message:'View (cid: "'+this.cid+'") has already been destroyed and cannot be used.'})},destroy:function(){if(this.isDestroyed)return this;var e=n.toArray(arguments);return this.triggerMethod.apply(this,["before:destroy"].concat(e)),this.isDestroyed=!0,this.triggerMethod.apply(this,["destroy"].concat(e)),this.unbindUIElements(),this.isRendered=!1,this.remove(),n.invoke(this._behaviors,"destroy",e),this},bindUIElements:function(){this._bindUIElements(),n.invoke(this._behaviors,this._bindUIElements)},_bindUIElements:function(){if(!this.ui)return;this._uiBindings||(this._uiBindings=this.ui);var e=n.result(this,"_uiBindings");this.ui={},n.each(e,function(e,t){this.ui[t]=this.$(e)},this)},unbindUIElements:function(){this._unbindUIElements(),n.invoke(this._behaviors,this._unbindUIElements)},_unbindUIElements:function(){if(!this.ui||!this._uiBindings)return;n.each(this.ui,function(e,t){delete this.ui[t]},this),this.ui=this._uiBindings,delete this._uiBindings},_buildViewTrigger:function(e){var t=n.defaults({},e,{preventDefault:!0,stopPropagation:!0}),r=n.isObject(e)?t.event:e;return function(e){e&&(e.preventDefault&&t.preventDefault&&e.preventDefault(),e.stopPropagation&&t.stopPropagation&&e.stopPropagation());var n={view:this,model:this.model,collection:this.collection};this.triggerMethod(r,n)}},setElement:function(){var e=t.View.prototype.setElement.apply(this,arguments);return n.invoke(this._behaviors,"proxyViewProperties",this),e},triggerMethod:function(){var e=s._triggerMethod(this,arguments);return this._triggerEventOnBehaviors(arguments),this._triggerEventOnParentLayout(arguments[0],n.rest(arguments)),e},_triggerEventOnBehaviors:function(e){var t=s._triggerMethod,n=this._behaviors;for(var r=0,i=n&&n.length;r<i;r++)t(n[r],e)},_triggerEventOnParentLayout:function(e,t){var r=this._parentLayoutView();if(!r)return;var i=s.getOption(r,"childViewEventPrefix"),o=i+":"+e,u=[this].concat(t);s._triggerMethod(r,o,u);var a=s.getOption(r,"childEvents"),f=r.normalizeMethods(a);f&&n.isFunction(f[e])&&f[e].apply(r,u)},_getImmediateChildren:function(){return[]},_getNestedViews:function(){var e=this._getImmediateChildren();return e.length?n.reduce(e,function(e,t){return t._getNestedViews?e.concat(t._getNestedViews()):e},e):e},_getAncestors:function(){var e=[],t=this._parent;while(t)e.push(t),t=t._parent;return e},_parentLayoutView:function(){var e=this._getAncestors();return n.find(e,function(e){return e instanceof s.LayoutView})},normalizeMethods:s.normalizeMethods,mergeOptions:s.mergeOptions,getOption:s.proxyGetOption,bindEntityEvents:s.proxyBindEntityEvents,unbindEntityEvents:s.proxyUnbindEntityEvents}),s.ItemView=s.View.extend({constructor:function(){s.View.apply(this,arguments)},serializeData:function(){if(!this.model&&!this.collection)return{};var e=[this.model||this.collection];return arguments.length&&e.push.apply(e,arguments),this.model?this.serializeModel.apply(this,e):{items:this.serializeCollection.apply(this,e)}},serializeCollection:function(e){return e.toJSON.apply(e,n.rest(arguments))},render:function(){return this._ensureViewIsIntact(),this.triggerMethod("before:render",this),this._renderTemplate(),this.isRendered=!0,this.bindUIElements(),this.triggerMethod("render",this),this},_renderTemplate:function(){var e=this.getTemplate();if(e===!1)return;if(!e)throw new s.Error({name:"UndefinedTemplateError",message:"Cannot render the template since it is null or undefined."});var t=this.mixinTemplateHelpers(this.serializeData()),n=s.Renderer.render(e,t,this);return this.attachElContent(n),this},attachElContent:function(e){return this.$el.html(e),this}}),s.CollectionView=s.View.extend({childViewEventPrefix:"childview",sort:!0,constructor:function(e){this.once("render",this._initialEvents),this._initChildViewStorage(),s.View.apply(this,arguments),this.on({"before:show":this._onBeforeShowCalled,show:this._onShowCalled,"before:attach":this._onBeforeAttachCalled,attach:this._onAttachCalled}),this.initRenderBuffer()},initRenderBuffer:function(){this._bufferedChildren=[]},startBuffering:function(){this.initRenderBuffer(),this.isBuffering=!0},endBuffering:function(){var e=this._isShown&&s.isNodeAttached(this.el),t;this.isBuffering=!1,this._isShown&&this._triggerMethodMany(this._bufferedChildren,this,"before:show"),e&&this._triggerBeforeAttach&&(t=this._getNestedViews(),this._triggerMethodMany(t,this,"before:attach")),this.attachBuffer(this,this._createBuffer()),e&&this._triggerAttach&&(t=this._getNestedViews(),this._triggerMethodMany(t,this,"attach")),this._isShown&&this._triggerMethodMany(this._bufferedChildren,this,"show"),this.initRenderBuffer()},_triggerMethodMany:function(e,t,r){var i=n.drop(arguments,3);n.each(e,function(e){s.triggerMethodOn.apply(e,[e,r,e,t].concat(i))})},_initialEvents:function(){this.collection&&(this.listenTo(this.collection,"add",this._onCollectionAdd),this.listenTo(this.collection,"remove",this._onCollectionRemove),this.listenTo(this.collection,"reset",this.render),this.getOption("sort")&&this.listenTo(this.collection,"sort",this._sortViews))},_onCollectionAdd:function(e,t,r){var i=r.at!==undefined&&(r.index||t.indexOf(e));if(this.getOption("filter")||i===!1)i=n.indexOf(this._filteredSortedModels(i),e);if(this._shouldAddChild(e,i)){this.destroyEmptyView();var s=this.getChildView(e);this.addChild(e,s,i)}},_onCollectionRemove:function(e){var t=this.children.findByModel(e);this.removeChildView(t),this.checkEmpty()},_onBeforeShowCalled:function(){this._triggerBeforeAttach=this._triggerAttach=!1,this.children.each(function(e){s.triggerMethodOn(e,"before:show",e)})},_onShowCalled:function(){this.children.each(function(e){s.triggerMethodOn(e,"show",e)})},_onBeforeAttachCalled:function(){this._triggerBeforeAttach=!0},_onAttachCalled:function(){this._triggerAttach=!0},render:function(){return this._ensureViewIsIntact(),this.triggerMethod("before:render",this),this._renderChildren(),this.isRendered=!0,this.triggerMethod("render",this),this},reorder:function(){var e=this.children,t=this._filteredSortedModels(),r=n.find(t,function(t){return!e.findByModel(t)});if(r)this.render();else{var i=n.map(t,function(t,n){var r=e.findByModel(t);return r._index=n,r.el});this.triggerMethod("before:reorder"),this._appendReorderedChildren(i),this.triggerMethod("reorder")}},resortView:function(){s.getOption(this,"reorderOnSort")?this.reorder():this.render()},_sortViews:function(){var e=this._filteredSortedModels(),t=n.find(e,function(e,t){var n=this.children.findByModel(e);return!n||n._index!==t},this);t&&this.resortView()},_emptyViewIndex:-1,_appendReorderedChildren:function(e){this.$el.append(e)},_renderChildren:function(){this.destroyEmptyView(),this.destroyChildren({checkEmpty:!1}),this.isEmpty(this.collection)?this.showEmptyView():(this.triggerMethod("before:render:collection",this),this.startBuffering(),this.showCollection(),this.endBuffering(),this.triggerMethod("render:collection",this),this.children.isEmpty()&&this.getOption("filter")&&this.showEmptyView())},showCollection:function(){var e,t=this._filteredSortedModels();n.each(t,function(t,n){e=this.getChildView(t),this.addChild(t,e,n)},this)},_filteredSortedModels:function(e){var t=this.getViewComparator(),r=this.collection.models;e=Math.min(Math.max(e,0),r.length-1);if(t){var i;e&&(i=r[e],r=r.slice(0,e).concat(r.slice(e+1))),r=this._sortModelsBy(r,t),i&&r.splice(e,0,i)}return this.getOption("filter")&&(r=n.filter(r,function(e,t){return this._shouldAddChild(e,t)},this)),r},_sortModelsBy:function(e,t){return typeof t=="string"?n.sortBy(e,function(e){return e.get(t)},this):t.length===1?n.sortBy(e,t,this):e.sort(n.bind(t,this))},showEmptyView:function(){var e=this.getEmptyView();if(e&&!this._showingEmptyView){this.triggerMethod("before:render:empty"),this._showingEmptyView=!0;var n=new t.Model;this.addEmptyView(n,e),this.triggerMethod("render:empty")}},destroyEmptyView:function(){this._showingEmptyView&&(this.triggerMethod("before:remove:empty"),this.destroyChildren(),delete this._showingEmptyView,this.triggerMethod("remove:empty"))},getEmptyView:function(){return this.getOption("emptyView")},addEmptyView:function(e,t){var r=this._isShown&&!this.isBuffering&&s.isNodeAttached(this.el),i,o=this.getOption("emptyViewOptions")||this.getOption("childViewOptions");n.isFunction(o)&&(o=o.call(this,e,this._emptyViewIndex));var u=this.buildChildView(e,t,o);u._parent=this,this.proxyChildEvents(u),u.once("render",function(){this._isShown&&s.triggerMethodOn(u,"before:show",u),r&&this._triggerBeforeAttach&&(i=this._getViewAndNested(u),this._triggerMethodMany(i,this,"before:attach"))},this),this.children.add(u),this.renderChildView(u,this._emptyViewIndex),r&&this._triggerAttach&&(i=this._getViewAndNested(u),this._triggerMethodMany(i,this,"attach")),this._isShown&&s.triggerMethodOn(u,"show",u)},getChildView:function(e){var t=this.getOption("childView");if(!t)throw new s.Error({name:"NoChildViewError",message:'A "childView" must be specified'});return t},addChild:function(e,t,n){var r=this.getOption("childViewOptions");r=s._getValue(r,this,[e,n]);var i=this.buildChildView(e,t,r);return this._updateIndices(i,!0,n),this.triggerMethod("before:add:child",i),this._addChildView(i,n),this.triggerMethod("add:child",i),i._parent=this,i},_updateIndices:function(e,t,n){if(!this.getOption("sort"))return;t&&(e._index=n),this.children.each(function(n){n._index>=e._index&&(n._index+=t?1:-1)})},_addChildView:function(e,t){var n=this._isShown&&!this.isBuffering&&s.isNodeAttached(this.el),r;this.proxyChildEvents(e),e.once("render",function(){this._isShown&&!this.isBuffering&&s.triggerMethodOn(e,"before:show",e),n&&this._triggerBeforeAttach&&(r=this._getViewAndNested(e),this._triggerMethodMany(r,this,"before:attach"))},this),this.children.add(e),this.renderChildView(e,t),n&&this._triggerAttach&&(r=this._getViewAndNested(e),this._triggerMethodMany(r,this,"attach")),this._isShown&&!this.isBuffering&&s.triggerMethodOn(e,"show",e)},renderChildView:function(e,t){return e.supportsRenderLifecycle||s.triggerMethodOn(e,"before:render",e),e.render(),e.supportsRenderLifecycle||s.triggerMethodOn(e,"render",e),this.attachHtml(this,e,t),e},buildChildView:function(e,t,r){var i=n.extend({model:e},r),o=new t(i);return s.MonitorDOMRefresh(o),o},removeChildView:function(e){return e?(this.triggerMethod("before:remove:child",e),e.supportsDestroyLifecycle||s.triggerMethodOn(e,"before:destroy",e),e.destroy?e.destroy():e.remove(),e.supportsDestroyLifecycle||s.triggerMethodOn(e,"destroy",e),delete e._parent,this.stopListening(e),this.children.remove(e),this.triggerMethod("remove:child",e),this._updateIndices(e,!1),e):e},isEmpty:function(){return!this.collection||this.collection.length===0},checkEmpty:function(){this.isEmpty(this.collection)&&this.showEmptyView()},attachBuffer:function(e,t){e.$el.append(t)},_createBuffer:function(){var e=document.createDocumentFragment();return n.each(this._bufferedChildren,function(t){e.appendChild(t.el)}),e},attachHtml:function(e,t,n){e.isBuffering?e._bufferedChildren.splice(n,0,t):e._insertBefore(t,n)||e._insertAfter(t)},_insertBefore:function(e,t){var n,r=this.getOption("sort")&&t<this.children.length-1;return r&&(n=this.children.find(function(e){return e._index===t+1})),n?(n.$el.before(e.el),!0):!1},_insertAfter:function(e){this.$el.append(e.el)},_initChildViewStorage:function(){this.children=new t.ChildViewContainer},destroy:function(){return this.isDestroyed?this:(this.triggerMethod("before:destroy:collection"),this.destroyChildren({checkEmpty:!1}),this.triggerMethod("destroy:collection"),s.View.prototype.destroy.apply(this,arguments))},destroyChildren:function(e){var t=e||{},r=!0,i=this.children.map(n.identity);return n.isUndefined(t.checkEmpty)||(r=t.checkEmpty),this.children.each(this.removeChildView,this),r&&this.checkEmpty(),i},_shouldAddChild:function(e,t){var r=this.getOption("filter");return!n.isFunction(r)||r.call(this,e,t,this.collection)},proxyChildEvents:function(e){var t=this.getOption("childViewEventPrefix");this.listenTo(e,"all",function(){var r=n.toArray(arguments),i=r[0],s=this.normalizeMethods(n.result(this,"childEvents"));r[0]=t+":"+i,r.splice(1,0,e),typeof s!="undefined"&&n.isFunction(s[i])&&s[i].apply(this,r.slice(1)),this.triggerMethod.apply(this,r)})},_getImmediateChildren:function(){return n.values(this.children._views)},_getViewAndNested:function(e){return[e].concat(n.result(e,"_getNestedViews")||[])},getViewComparator:function(){return this.getOption("viewComparator")}}),s.CompositeView=s.CollectionView.extend({constructor:function(){s.CollectionView.apply(this,arguments)},_initialEvents:function(){this.collection&&(this.listenTo(this.collection,"add",this._onCollectionAdd),this.listenTo(this.collection,"remove",this._onCollectionRemove),this.listenTo(this.collection,"reset",this._renderChildren),this.getOption("sort")&&this.listenTo(this.collection,"sort",this._sortViews))},getChildView:function(e){var t=this.getOption("childView")||this.constructor;return t},serializeData:function(){var e={};return this.model&&(e=n.partial(this.serializeModel,this.model).apply(this,arguments)),e},render:function(){return this._ensureViewIsIntact(),this._isRendering=!0,this.resetChildViewContainer(),this.triggerMethod("before:render",this),this._renderTemplate(),this._renderChildren(),this._isRendering=!1,this.isRendered=!0,this.triggerMethod("render",this),this},_renderChildren:function(){(this.isRendered||this._isRendering)&&s.CollectionView.prototype._renderChildren.call(this)},_renderTemplate:function(){var e={};e=this.serializeData(),e=this.mixinTemplateHelpers(e),this.triggerMethod("before:render:template");var t=this.getTemplate(),n=s.Renderer.render(t,e,this);this.attachElContent(n),this.bindUIElements(),this.triggerMethod("render:template")},attachElContent:function(e){return this.$el.html(e),this},attachBuffer:function(e,t){var n=this.getChildViewContainer(e);n.append(t)},_insertAfter:function(e){var t=this.getChildViewContainer(this,e);t.append(e.el)},_appendReorderedChildren:function(e){var t=this.getChildViewContainer(this);t.append(e)},getChildViewContainer:function(e,t){if(!e.$childViewContainer){var n,r=s.getOption(e,"childViewContainer");if(r){var i=s._getValue(r,e);i.charAt(0)==="@"&&e.ui?n=e.ui[i.substr(4)]:n=e.$(i);if(n.length<=0)throw new s.Error({name:"ChildViewContainerMissingError",message:'The specified "childViewContainer" was not found: '+e.childViewContainer})}else n=e.$el;return e.$childViewContainer=n,n}return e.$childViewContainer},resetChildViewContainer:function(){this.$childViewContainer&&(this.$childViewContainer=undefined)}}),s.LayoutView=s.ItemView.extend({regionClass:s.Region,options:{destroyImmediate:!1},childViewEventPrefix:"childview",constructor:function(e){e=e||{},this._firstRender=!0,this._initializeRegions(e),s.ItemView.call(this,e)},render:function(){return this._ensureViewIsIntact(),this._firstRender?this._firstRender=!1:this._reInitializeRegions(),s.ItemView.prototype.render.apply(this,arguments)},destroy:function(){return this.isDestroyed?this:(this.getOption("destroyImmediate")===!0&&this.$el.remove(),this.regionManager.destroy(),s.ItemView.prototype.destroy.apply(this,arguments))},showChildView:function(e,t){return this.getRegion(e).show(t)},getChildView:function(e){return this.getRegion(e).currentView},addRegion:function(e,t){var n={};return n[e]=t,this._buildRegions(n)[e]},addRegions:function(e){return this.regions=n.extend({},this.regions,e),this._buildRegions(e)},removeRegion:function(e){return delete this.regions[e],this.regionManager.removeRegion(e)},getRegion:function(e){return this.regionManager.get(e)},getRegions:function(){return this.regionManager.getRegions()},_buildRegions:function(e){var t={regionClass:this.getOption("regionClass"),parentEl:n.partial(n.result,this,"el")};return this.regionManager.addRegions(e,t)},_initializeRegions:function(e){var t;this._initRegionManager(),t=s._getValue(this.regions,this,[e])||{};var r=this.getOption.call(e,"regions");r=s._getValue(r,this,[e]),n.extend(t,r),t=this.normalizeUIValues(t,["selector","el"]),this.addRegions(t)},_reInitializeRegions:function(){this.regionManager.invoke("reset")},getRegionManager:function(){return new s.RegionManager},_initRegionManager:function(){this.regionManager=this.getRegionManager(),this.regionManager._parent=this,this.listenTo(this.regionManager,"before:add:region",function(e){this.triggerMethod("before:add:region",e)}),this.listenTo(this.regionManager,"add:region",function(e,t){this[e]=t,this.triggerMethod("add:region",e,t)}),this.listenTo(this.regionManager,"before:remove:region",function(e){this.triggerMethod("before:remove:region",e)}),this.listenTo(this.regionManager,"remove:region",function(e,t){delete this[e],this.triggerMethod("remove:region",e,t)})},_getImmediateChildren:function(){return n.chain(this.regionManager.getRegions()).pluck("currentView").compact().value()}}),s.Behavior=s.Object.extend({constructor:function(e,t){this.view=t,this.defaults=n.result(this,"defaults")||{},this.options=n.extend({},this.defaults,e),this.ui=n.extend({},n.result(t,"ui"),n.result(this,"ui")),s.Object.apply(this,arguments)},$:function(){return this.view.$.apply(this.view,arguments)},destroy:function(){return this.stopListening(),this},proxyViewProperties:function(e){this.$el=e.$el,this.el=e.el}}),s.Behaviors=function(e,t){function r(e,n){return t.isObject(e.behaviors)?(n=r.parseBehaviors(e,n||t.result(e,"behaviors")),r.wrap(e,n,t.keys(i)),n):{}}function s(e,t){this._view=e,this._behaviors=t,this._triggers={}}function o(e){return e._uiBindings||e.ui}var n=/^(\S+)\s*(.*)$/,i={behaviorTriggers:function(e,t){var n=new s(this,t);return n.buildBehaviorTriggers()},behaviorEvents:function(r,i){var s={};return t.each(i,function(r,i){var u={},a=t.clone(t.result(r,"events"))||{};a=e.normalizeUIKeys(a,o(r));var f=0;t.each(a,function(e,s){var o=s.match(n),a=o[1]+"."+[this.cid,i,f++," "].join(""),l=o[2],c=a+l,h=t.isFunction(e)?e:r[e];u[c]=t.bind(h,r)},this),s=t.extend(s,u)},this),s}};return t.extend(r,{behaviorsLookup:function(){throw new e.Error({message:"You must define where your behaviors are stored.",url:"marionette.behaviors.html#behaviorslookup"})},getBehaviorClass:function(t,n){return t.behaviorClass?t.behaviorClass:e._getValue(r.behaviorsLookup,this,[t,n])[n]},parseBehaviors:function(e,n){return t.chain(n).map(function(n,i){var s=r.getBehaviorClass(n,i),o=new s(n,e),u=r.parseBehaviors(e,t.result(o,"behaviors"));return[o].concat(u)}).flatten().value()},wrap:function(e,n,r){t.each(r,function(r){e[r]=t.partial(i[r],e[r],n)})}}),t.extend(s.prototype,{buildBehaviorTriggers:function(){return t.each(this._behaviors,this._buildTriggerHandlersForBehavior,this),this._triggers},_buildTriggerHandlersForBehavior:function(n,r){var i=t.clone(t.result(n,"triggers"))||{};i=e.normalizeUIKeys(i,o(n)),t.each(i,t.bind(this._setHandlerForBehavior,this,n,r))},_setHandlerForBehavior:function(e,t,n,r){var i=r.replace(/^\S+/,function(e){return e+"."+"behaviortriggers"+t});this._triggers[i]=this._view._buildViewTrigger(n)}}),r}(s,n),s.AppRouter=t.Router.extend({constructor:function(e){this.options=e||{},t.Router.apply(this,arguments);var n=this.getOption("appRoutes"),r=this._getController();this.processAppRoutes(r,n),this.on("route",this._processOnRoute,this)},appRoute:function(e,t){var n=this._getController();this._addAppRoute(n,e,t)},_processOnRoute:function(e,t){if(n.isFunction(this.onRoute)){var r=n.invert(this.getOption("appRoutes"))[e];this.onRoute(e,r,t)}},processAppRoutes:function(e,t){if(!t)return;var r=n.keys(t).reverse();n.each(r,function(n){this._addAppRoute(e,n,t[n])},this)},_getController:function(){return this.getOption("controller")},_addAppRoute:function(e,t,r){var i=e[r];if(!i)throw new s.Error('Method "'+r+'" was not found on the controller');this.route(t,r,n.bind(i,e))},mergeOptions:s.mergeOptions,getOption:s.proxyGetOption,triggerMethod:s.triggerMethod,bindEntityEvents:s.proxyBindEntityEvents,unbindEntityEvents:s.proxyUnbindEntityEvents}),s.Application=s.Object.extend({constructor:function(e){this._initializeRegions(e),this._initCallbacks=new s.Callbacks,this.submodules={},n.extend(this,e),this._initChannel(),s.Object.apply(this,arguments)},execute:function(){this.commands.execute.apply(this.commands,arguments)},request:function(){return this.reqres.request.apply(this.reqres,arguments)},addInitializer:function(e){this._initCallbacks.add(e)},start:function(e){this.triggerMethod("before:start",e),this._initCallbacks.run(e,this),this.triggerMethod("start",e)},addRegions:function(e){return this._regionManager.addRegions(e)},emptyRegions:function(){return this._regionManager.emptyRegions()},removeRegion:function(e){return this._regionManager.removeRegion(e)},getRegion:function(e){return this._regionManager.get(e)},getRegions:function(){return this._regionManager.getRegions()},module:function(e,t){var r=s.Module.getClass(t),i=n.toArray(arguments);return i.unshift(this),r.create.apply(r,i)},getRegionManager:function(){return new s.RegionManager},_initializeRegions:function(e){var t=n.isFunction(this.regions)?this.regions(e):this.regions||{};this._initRegionManager();var r=s.getOption(e,"regions");return n.isFunction(r)&&(r=r.call(this,e)),n.extend(t,r),this.addRegions(t),this},_initRegionManager:function(){this._regionManager=this.getRegionManager(),this._regionManager._parent=this,this.listenTo(this._regionManager,"before:add:region",function(){s._triggerMethod(this,"before:add:region",arguments)}),this.listenTo(this._regionManager,"add:region",function(e,t){this[e]=t,s._triggerMethod(this,"add:region",arguments)}),this.listenTo(this._regionManager,"before:remove:region",function(){s._triggerMethod(this,"before:remove:region",arguments)}),this.listenTo(this._regionManager,"remove:region",function(e){delete this[e],s._triggerMethod(this,"remove:region",arguments)})},_initChannel:function(){this.channelName=n.result(this,"channelName")||"global",this.channel=n.result(this,"channel")||t.Wreqr.radio.channel(this.channelName),this.vent=n.result(this,"vent")||this.channel.vent,this.commands=n.result(this,"commands")||this.channel.commands,this.reqres=n.result(this,"reqres")||this.channel.reqres}}),s.Module=function(e,t,r){this.moduleName=e,this.options=n.extend({},this.options,r),this.initialize=r.initialize||this.initialize,this.submodules={},this._setupInitializersAndFinalizers(),this.app=t,n.isFunction(this.initialize)&&this.initialize(e,t,this.options)},s.Module.extend=s.extend,n.extend(s.Module.prototype,t.Events,{startWithParent:!0,initialize:function(){},addInitializer:function(e){this._initializerCallbacks.add(e)},addFinalizer:function(e){this._finalizerCallbacks.add(e)},start:function(e){if(this._isInitialized)return;n.each(this.submodules,function(t){t.startWithParent&&t.start(e)}),this.triggerMethod("before:start",e),this._initializerCallbacks.run(e,this),this._isInitialized=!0,this.triggerMethod("start",e)},stop:function(){if(!this._isInitialized)return;this._isInitialized=!1,this.triggerMethod("before:stop"),n.invoke(this.submodules,"stop"),this._finalizerCallbacks.run(undefined,this),this._initializerCallbacks.reset(),this._finalizerCallbacks.reset(),this.triggerMethod("stop")},addDefinition:function(e,t){this._runModuleDefinition(e,t)},_runModuleDefinition:function(e,r){if(!e)return;var i=n.flatten([this,this.app,t,s,t.$,n,r]);e.apply(this,i)},_setupInitializersAndFinalizers:function(){this._initializerCallbacks=new s.Callbacks,this._finalizerCallbacks=new s.Callbacks},triggerMethod:s.triggerMethod}),n.extend(s.Module,{create:function(e,t,r){var i=e,s=n.drop(arguments,3);t=t.split(".");var o=t.length,u=[];return u[o-1]=r,n.each(t,function(t,n){var o=i;i=this._getModule(o,t,e,r),this._addModuleDefinition(o,i,u[n],s)},this),i},_getModule:function(e,t,r,i,s){var o=n.extend({},i),u=this.getClass(i),a=e[t];return a||(a=new u(t,r,o),e[t]=a,e.submodules[t]=a),a},getClass:function(e){var t=s.Module;return e?e.prototype instanceof t?e:e.moduleClass||t:t},_addModuleDefinition:function(e,t,n,r){var i=this._getDefine(n),s=this._getStartWithParent(n,t);i&&t.addDefinition(i,r),this._addStartWithParent(e,t,s)},_getStartWithParent:function(e,t){var r;return n.isFunction(e)&&e.prototype instanceof s.Module?(r=t.constructor.prototype.startWithParent,n.isUndefined(r)?!0:r):n.isObject(e)?(r=e.startWithParent,n.isUndefined(r)?!0:r):!0},_getDefine:function(e){return!n.isFunction(e)||e.prototype instanceof s.Module?n.isObject(e)?e.define:null:e},_addStartWithParent:function(e,t,n){t.startWithParent=t.startWithParent&&n;if(!t.startWithParent||!!t.startWithParentIsConfigured)return;t.startWithParentIsConfigured=!0,e.addInitializer(function(e){t.startWithParent&&t.start(e)})}}),s}),function(e,t){typeof exports=="object"&&typeof module!="undefined"?module.exports=t(require("underscore"),require("backbone")):typeof define=="function"&&define.amd?define("backbone.radio",["underscore","backbone"],t):e.Backbone.Radio=t(e._,e.Backbone)}(this,function(e,t){"use strict";function s(e,t,n,r){var i=e[t];if((!n||n===i.callback||n===i.callback._callback)&&(!r||r===i.context))return delete e[t],!0}function o(t,n,r,i){t||(t={});var o=n?[n]:e.keys(t),u=!1;for(var a=0,f=o.length;a<f;a++){n=o[a];if(!t[n])continue;s(t,n,r,i)&&(u=!0)}return u}function a(t){return u[t]||(u[t]=e.partial(r.log,t))}function f(t){return e.isFunction(t)?t:function(){return t}}var n=t.Radio,r=t.Radio={};r.VERSION="1.0.2",r.noConflict=function(){return t.Radio=n,this},r.DEBUG=!1,r._debugText=function(e,t,n){return e+(n?" on the "+n+" channel":"")+': "'+t+'"'},r.debugLog=function(e,t,n){r.DEBUG&&console&&console.warn&&console.warn(r._debugText(e,t,n))};var i=/\s+/;r._eventsApi=function(t,n,r,s){if(!r)return!1;var o={};if(typeof r=="object"){for(var u in r){var a=t[n].apply(t,[u,r[u]].concat(s));i.test(u)?e.extend(o,a):o[u]=a}return o}if(i.test(r)){var f=r.split(i);for(var l=0,c=f.length;l<c;l++)o[f[l]]=t[n].apply(t,[f[l]].concat(s));return o}return!1},r._callHandler=function(e,t,n){var r=n[0],i=n[1],s=n[2];switch(n.length){case 0:return e.call(t);case 1:return e.call(t,r);case 2:return e.call(t,r,i);case 3:return e.call(t,r,i,s);default:return e.apply(t,n)}};var u={};e.extend(r,{log:function(n,r){var i=e.rest(arguments,2);console.log("["+n+'] "'+r+'"',i)},tuneIn:function(t){var n=r.channel(t);return n._tunedIn=!0,n.on("all",a(t)),this},tuneOut:function(t){var n=r.channel(t);return n._tunedIn=!1,n.off("all",a(t)),delete u[t],this}}),r.Requests={request:function(n){var i=e.rest(arguments),s=r._eventsApi(this,"request",n,i);if(s)return s;var o=this.channelName,u=this._requests;o&&this._tunedIn&&r.log.apply(this,[o,n].concat(i));if(u&&(u[n]||u["default"])){var a=u[n]||u["default"];return i=u[n]?i:arguments,r._callHandler(a.callback,a.context,i)}r.debugLog("An unhandled request was fired",n,o)},reply:function(t,n,i){return r._eventsApi(this,"reply",t,[n,i])?this:(this._requests||(this._requests={}),this._requests[t]&&r.debugLog("A request was overwritten",t,this.channelName),this._requests[t]={callback:f(n),context:i||this},this)},replyOnce:function(n,i,s){if(r._eventsApi(this,"replyOnce",n,[i,s]))return this;var o=this,u=e.once(function(){return o.stopReplying(n),f(i).apply(this,arguments)});return this.reply(n,u,s)},stopReplying:function(t,n,i){return r._eventsApi(this,"stopReplying",t)?this:(!t&&!n&&!i?delete this._requests:o(this._requests,t,n,i)||r.debugLog("Attempted to remove the unregistered request",t,this.channelName),this)}},r._channels={},r.channel=function(e){if(!e)throw new Error("You must provide a name for the channel.");return r._channels[e]?r._channels[e]:r._channels[e]=new r.Channel(e)},r.Channel=function(e){this.channelName=e},e.extend(r.Channel.prototype,t.Events,r.Requests,{reset:function(){return this.off(),this.stopListening(),this.stopReplying(),this}});var l,c,h=[t.Events,r.Commands,r.Requests];e.each(h,function(t){e.each(t,function(t,n){r[n]=function(t){return c=e.rest(arguments),l=this.channel(t),l[n].apply(l,c)}})}),r.reset=function(t){var n=t?[this._channels[t]]:this._channels;e.invoke(n,"reset")};var p=r;return p}),function(e){function n(e){this.options=t.extend({},n.defaultOptions,e),this.clear()}function r(e){this.options=t.extend({},r.defaultChartOptions,e),this.seriesSet=[],this.currentValueRange=1,this.currentVisMinValue=0,this.lastRenderTimeMillis=0}var t={extend:function(){arguments[0]=arguments[0]||{};for(var e=1;e<arguments.length;e++)for(var n in arguments[e])arguments[e].hasOwnProperty(n)&&(typeof arguments[e][n]=="object"?arguments[e][n]instanceof Array?arguments[0][n]=arguments[e][n]:arguments[0][n]=t.extend(arguments[0][n],arguments[e][n]):arguments[0][n]=arguments[e][n]);return arguments[0]}};n.defaultOptions={resetBoundsInterval:3e3,resetBounds:!0},n.prototype.clear=function(){this.data=[],this.maxValue=Number.NaN,this.minValue=Number.NaN},n.prototype.resetBounds=function(){if(this.data.length){this.maxValue=this.data[0][1],this.minValue=this.data[0][1];for(var e=1;e<this.data.length;e++){var t=this.data[e][1];t>this.maxValue&&(this.maxValue=t),t<this.minValue&&(this.minValue=t)}}else this.maxValue=Number.NaN,this.minValue=Number.NaN},n.prototype.append=function(e,t,n){var r=this.data.length-1;while(r>=0&&this.data[r][0]>e)r--;r===-1?this.data.splice(0,0,[e,t]):this.data.length>0&&this.data[r][0]===e?n?(this.data[r][1]+=t,t=this.data[r][1]):this.data[r][1]=t:r<this.data.length-1?this.data.splice(r+1,0,[e,t]):this.data.push([e,t]),this.maxValue=isNaN(this.maxValue)?t:Math.max(this.maxValue,t),this.minValue=isNaN(this.minValue)?t:Math.min(this.minValue,t)},n.prototype.dropOldData=function(e,t){var n=0;while(this.data.length-n>=t&&this.data[n+1][0]<e)n++;n!==0&&this.data.splice(0,n)},r.defaultChartOptions={millisPerPixel:20,enableDpiScaling:!0,yMinFormatter:function(e,t){return parseFloat(e).toFixed(t)},yMaxFormatter:function(e,t){return parseFloat(e).toFixed(t)},maxValueScale:1,interpolation:"bezier",scaleSmoothing:.125,maxDataSetLength:2,grid:{fillStyle:"#000000",strokeStyle:"#777777",lineWidth:1,sharpLines:!1,millisPerLine:1e3,verticalSections:2,borderVisible:!0},labels:{fillStyle:"#ffffff",disabled:!1,fontSize:10,fontFamily:"monospace",precision:2},horizontalLines:[]},r.AnimateCompatibility=function(){var e=function(e,t){var n=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(e){return window.setTimeout(function(){e((new Date).getTime())},16)};return n.call(window,e,t)},t=function(e){var t=window.cancelAnimationFrame||function(e){clearTimeout(e)};return t.call(window,e)};return{requestAnimationFrame:e,cancelAnimationFrame:t}}(),r.defaultSeriesPresentationOptions={lineWidth:1,strokeStyle:"#ffffff"},r.prototype.addTimeSeries=function(e,n){this.seriesSet.push({timeSeries:e,options:t.extend({},r.defaultSeriesPresentationOptions,n)}),e.options.resetBounds&&e.options.resetBoundsInterval>0&&(e.resetBoundsTimerId=setInterval(function(){e.resetBounds()},e.options.resetBoundsInterval))},r.prototype.removeTimeSeries=function(e){var t=this.seriesSet.length;for(var n=0;n<t;n++)if(this.seriesSet[n].timeSeries===e){this.seriesSet.splice(n,1);break}e.resetBoundsTimerId&&clearInterval(e.resetBoundsTimerId)},r.prototype.getTimeSeriesOptions=function(e){var t=this.seriesSet.length;for(var n=0;n<t;n++)if(this.seriesSet[n].timeSeries===e)return this.seriesSet[n].options},r.prototype.bringToFront=function(e){var t=this.seriesSet.length;for(var n=0;n<t;n++)if(this.seriesSet[n].timeSeries===e){var r=this.seriesSet.splice(n,1);this.seriesSet.push(r[0]);break}},r.prototype.streamTo=function(e,t){this.canvas=e,this.delay=t,this.start()},r.prototype.resize=function(){if(!this.options.enableDpiScaling||!window||window.devicePixelRatio===1)return;var e=window.devicePixelRatio,t=parseInt(this.canvas.getAttribute("width")),n=parseInt(this.canvas.getAttribute("height"));if(!this.originalWidth||Math.floor(this.originalWidth*e)!==t)this.originalWidth=t,this.canvas.setAttribute("width",Math.floor(t*e).toString()),this.canvas.style.width=t+"px",this.canvas.getContext("2d").scale(e,e);if(!this.originalHeight||Math.floor(this.originalHeight*e)!==n)this.originalHeight=n,this.canvas.setAttribute("height",Math.floor(n*e).toString()),this.canvas.style.height=n+"px",this.canvas.getContext("2d").scale(e,e)},r.prototype.start=function(){if(this.frame)return;var e=function(){this.frame=r.AnimateCompatibility.requestAnimationFrame(function(){this.render(),e()}.bind(this))}.bind(this);e()},r.prototype.stop=function(){this.frame&&(r.AnimateCompatibility.cancelAnimationFrame(this.frame),delete this.frame)},r.prototype.updateValueRange=function(){var e=this.options,t=Number.NaN,n=Number.NaN;for(var r=0;r<this.seriesSet.length;r++){var i=this.seriesSet[r].timeSeries;isNaN(i.maxValue)||(t=isNaN(t)?i.maxValue:Math.max(t,i.maxValue)),isNaN(i.minValue)||(n=isNaN(n)?i.minValue:Math.min(n,i.minValue))}e.maxValue!=null?t=e.maxValue:t*=e.maxValueScale,e.minValue!=null&&(n=e.minValue);if(this.options.yRangeFunction){var s=this.options.yRangeFunction({min:n,max:t});n=s.min,t=s.max}if(!isNaN(t)&&!isNaN(n)){var o=t-n,u=o-this.currentValueRange,a=n-this.currentVisMinValue;this.isAnimatingScale=Math.abs(u)>.1||Math.abs(a)>.1,this.currentValueRange+=e.scaleSmoothing*u,this.currentVisMinValue+=e.scaleSmoothing*a}this.valueRange={min:n,max:t}},r.prototype.render=function(e,t){var n=(new Date).getTime();if(!this.isAnimatingScale){var r=Math.min(1e3/6,this.options.millisPerPixel);if(n-this.lastRenderTimeMillis<r)return}this.resize(),this.lastRenderTimeMillis=n,e=e||this.canvas,t=t||n-(this.delay||0),t-=t%this.options.millisPerPixel;var i=e.getContext("2d"),s=this.options,o={top:0,left:0,width:e.clientWidth,height:e.clientHeight},u=t-o.width*s.millisPerPixel,a=function(e){var t=e-this.currentVisMinValue;return this.currentValueRange===0?o.height:o.height-Math.round(t/this.currentValueRange*o.height)}.bind(this),f=function(e){return Math.round(o.width-(t-e)/s.millisPerPixel)};this.updateValueRange(),i.font=s.labels.fontSize+"px "+s.labels.fontFamily,i.save(),i.translate(o.left,o.top),i.beginPath(),i.rect(0,0,o.width,o.height),i.clip(),i.save(),i.fillStyle=s.grid.fillStyle,i.clearRect(0,0,o.width,o.height),i.fillRect(0,0,o.width,o.height),i.restore(),i.save(),i.lineWidth=s.grid.lineWidth,i.strokeStyle=s.grid.strokeStyle;if(s.grid.millisPerLine>0){i.beginPath();for(var l=t-t%s.grid.millisPerLine;l>=u;l-=s.grid.millisPerLine){var c=f(l);s.grid.sharpLines&&(c-=.5),i.moveTo(c,0),i.lineTo(c,o.height)}i.stroke(),i.closePath()}for(var h=1;h<s.grid.verticalSections;h++){var p=Math.round(h*o.height/s.grid.verticalSections);s.grid.sharpLines&&(p-=.5),i.beginPath(),i.moveTo(0,p),i.lineTo(o.width,p),i.stroke(),i.closePath()}s.grid.borderVisible&&(i.beginPath(),i.strokeRect(0,0,o.width,o.height),i.closePath()),i.restore();if(s.horizontalLines&&s.horizontalLines.length)for(var d=0;d<s.horizontalLines.length;d++){var v=s.horizontalLines[d],m=Math.round(a(v.value))-.5;i.strokeStyle=v.color||"#ffffff",i.lineWidth=v.lineWidth||1,i.beginPath(),i.moveTo(0,m),i.lineTo(o.width,m),i.stroke(),i.closePath()}for(var g=0;g<this.seriesSet.length;g++){i.save();var y=this.seriesSet[g].timeSeries,b=y.data,w=this.seriesSet[g].options;y.dropOldData(u,s.maxDataSetLength),i.lineWidth=w.lineWidth,i.strokeStyle=w.strokeStyle,i.beginPath();var E=0,S=0,x=0;for(var T=0;T<b.length&&b.length!==1;T++){var N=f(b[T][0]),C=a(b[T][1]);if(T===0)E=N,i.moveTo(N,C);else switch(s.interpolation){case"linear":case"line":i.lineTo(N,C);break;case"bezier":default:i.bezierCurveTo(Math.round((S+N)/2),x,Math.round(S+N)/2,C,N,C);break;case"step":i.lineTo(N,x),i.lineTo(N,C)}S=N,x=C}b.length>1&&(w.fillStyle&&(i.lineTo(o.width+w.lineWidth+1,x),i.lineTo(o.width+w.lineWidth+1,o.height+w.lineWidth+1),i.lineTo(E,o.height+w.lineWidth),i.fillStyle=w.fillStyle,i.fill()),w.strokeStyle&&w.strokeStyle!=="none"&&i.stroke(),i.closePath()),i.restore()}if(!s.labels.disabled&&!isNaN(this.valueRange.min)&&!isNaN(this.valueRange.max)){var k=s.yMaxFormatter(this.valueRange.max,s.labels.precision),L=s.yMinFormatter(this.valueRange.min,s.labels.precision);i.fillStyle=s.labels.fillStyle,i.fillText(k,o.width-i.measureText(k).width-2,s.labels.fontSize),i.fillText(L,o.width-i.measureText(L).width-2,o.height-2)}if(s.timestampFormatter&&s.grid.millisPerLine>0){var A=o.width-i.measureText(L).width+4;for(var l=t-t%s.grid.millisPerLine;l>=u;l-=s.grid.millisPerLine){var c=f(l);if(c<A){var O=new Date(l),M=s.timestampFormatter(O),_=i.measureText(M).width;A=c-_-2,i.fillStyle=s.labels.fillStyle,i.fillText(M,c-_,o.height-2)}}}i.restore()},r.timeFormatter=function(e){function t(e){return(e<10?"0":"")+e}return t(e.getHours())+":"+t(e.getMinutes())+":"+t(e.getSeconds())},e.TimeSeries=n,e.SmoothieChart=r}(typeof exports=="undefined"?this:exports),define("smoothie",function(){}),function(t,n){typeof exports=="object"&&typeof module=="object"?module.exports=n():typeof define=="function"&&define.amd?define("handlebars",n):typeof exports=="object"?exports.Handlebars=n():t.Handlebars=n()}(this,function(){return function(e){function n(r){if(t[r])return t[r].exports;var i=t[r]={exports:{},id:r,loaded:!1};return e[r].call(i.exports,i,i.exports,n),i.loaded=!0,i.exports}var t={};return n.m=e,n.c=t,n.p="",n(0)}([function(e,t,n){"use strict";function g(){var e=m();return e.compile=function(t,n){return f.compile(t,n,e)},e.precompile=function(t,n){return f.precompile(t,n,e)},e.AST=u["default"],e.Compiler=f.Compiler,e.JavaScriptCompiler=c["default"],e.Parser=a.parser,e.parse=a.parse,e}var r=n(8)["default"];t.__esModule=!0;var i=n(1),s=r(i),o=n(2),u=r(o),a=n(3),f=n(4),l=n(5),c=r(l),h=n(6),p=r(h),d=n(7),v=r(d),m=s["default"].create,y=g();y.create=g,v["default"](y),y.Visitor=p["default"],y["default"]=y,t["default"]=y,e.exports=t["default"]},function(e,t,n){"use strict";function m(){var e=new s.HandlebarsEnvironment;return c.extend(e,s),e.SafeString=u["default"],e.Exception=f["default"],e.Utils=c,e.escapeExpression=c.escapeExpression,e.VM=p,e.template=function(t){return p.template(t,e)},e}var r=n(8)["default"];t.__esModule=!0;var i=n(9),s=r(i),o=n(10),u=r(o),a=n(11),f=r(a),l=n(12),c=r(l),h=n(13),p=r(h),d=n(7),v=r(d),g=m();g.create=m,v["default"](g),g["default"]=g,t["default"]=g,e.exports=t["default"]},function(e,t,n){"use strict";t.__esModule=!0;var r={Program:function(t,n,r,i){this.loc=i,this.type="Program",this.body=t,this.blockParams=n,this.strip=r},MustacheStatement:function(t,n,r,i,s,o){this.loc=o,this.type="MustacheStatement",this.path=t,this.params=n||[],this.hash=r,this.escaped=i,this.strip=s},BlockStatement:function(t,n,r,i,s,o,u,a,f){this.loc=f,this.type="BlockStatement",this.path=t,this.params=n||[],this.hash=r,this.program=i,this.inverse=s,this.openStrip=o,this.inverseStrip=u,this.closeStrip=a},PartialStatement:function(t,n,r,i,s){this.loc=s,this.type="PartialStatement",this.name=t,this.params=n||[],this.hash=r,this.indent="",this.strip=i},ContentStatement:function(t,n){this.loc=n,this.type="ContentStatement",this.original=this.value=t},CommentStatement:function(t,n,r){this.loc=r,this.type="CommentStatement",this.value=t,this.strip=n},SubExpression:function(t,n,r,i){this.loc=i,this.type="SubExpression",this.path=t,this.params=n||[],this.hash=r},PathExpression:function(t,n,r,i,s){this.loc=s,this.type="PathExpression",this.data=t,this.original=i,this.parts=r,this.depth=n},StringLiteral:function(t,n){this.loc=n,this.type="StringLiteral",this.original=this.value=t},NumberLiteral:function(t,n){this.loc=n,this.type="NumberLiteral",this.original=this.value=Number(t)},BooleanLiteral:function(t,n){this.loc=n,this.type="BooleanLiteral",this.original=this.value=t==="true"},UndefinedLiteral:function(t){this.loc=t,this.type="UndefinedLiteral",this.original=this.value=undefined},NullLiteral:function(t){this.loc=t,this.type="NullLiteral",this.original=this.value=null},Hash:function(t,n){this.loc=n,this.type="Hash",this.pairs=t},HashPair:function(t,n,r){this.loc=r,this.type="HashPair",this.key=t,this.value=n},helpers:{helperExpression:function(t){return t.type==="SubExpression"||!!t.params.length||!!t.hash},scopedId:function(t){return/^\.|this\b/.test(t.original)},simpleId:function(t){return t.parts.length===1&&!r.helpers.scopedId(t)&&!t.depth}}};t["default"]=r,e.exports=t["default"]},function(e,t,n){"use strict";function d(e,t){if(e.type==="Program")return e;s["default"].yy=p,p.locInfo=function(e){return new p.SourceLocation(t&&t.srcName,e)};var n=new f["default"];return n.accept(s["default"].parse(e))}var r=n(8)["default"];t.__esModule=!0,t.parse=d;var i=n(14),s=r(i),o=n(2),u=r(o),a=n(15),f=r(a),l=n(16),c=r(l),h=n(12);t.parser=s["default"];var p={};h.extend(p,c,u["default"])},function(e,t,n){"use strict";function l(){}function c(e,t,n){if(e==null||typeof e!="string"&&e.type!=="Program")throw new s["default"]("You must pass a string or Handlebars AST to Handlebars.precompile. You passed "+e);t=t||{},"data"in t||(t.data=!0),t.compat&&(t.useDepths=!0);var r=n.parse(e,t),i=(new n.Compiler).compile(r,t);return(new n.JavaScriptCompiler).compile(i,t)}function h(e,t,n){function o(){var t=n.parse(e,r),i=(new n.Compiler).compile(t,r),s=(new n.JavaScriptCompiler).compile(i,r,undefined,!0);return n.template(s)}function u(e,t){return i||(i=o()),i.call(this,e,t)}var r=arguments[1]===undefined?{}:arguments[1];if(e==null||typeof e!="string"&&e.type!=="Program")throw new s["default"]("You must pass a string or Handlebars AST to Handlebars.compile. You passed "+e);"data"in r||(r.data=!0),r.compat&&(r.useDepths=!0);var i=undefined;return u._setup=function(e){return i||(i=o()),i._setup(e)},u._child=function(e,t,n,r){return i||(i=o()),i._child(e,t,n,r)},u}function p(e,t){if(e===t)return!0;if(o.isArray(e)&&o.isArray(t)&&e.length===t.length){for(var n=0;n<e.length;n++)if(!p(e[n],t[n]))return!1;return!0}}function d(e){if(!e.path.parts){var t=e.path;e.path=new a["default"].PathExpression(!1,0,[t.original+""],t.original+"",t.loc)}}var r=n(8)["default"];t.__esModule=!0,t.Compiler=l,t.precompile=c,t.compile=h;var i=n(11),s=r(i),o=n(12),u=n(2),a=r(u),f=[].slice;l.prototype={compiler:l,equals:function(t){var n=this.opcodes.length;if(t.opcodes.length!==n)return!1;for(var r=0;r<n;r++){var i=this.opcodes[r],s=t.opcodes[r];if(i.opcode!==s.opcode||!p(i.args,s.args))return!1}n=this.children.length;for(var r=0;r<n;r++)if(!this.children[r].equals(t.children[r]))return!1;return!0},guid:0,compile:function(t,n){this.sourceNode=[],this.opcodes=[],this.children=[],this.options=n,this.stringParams=n.stringParams,this.trackIds=n.trackIds,n.blockParams=n.blockParams||[];var r=n.knownHelpers;n.knownHelpers={helperMissing:!0,blockHelperMissing:!0,each:!0,"if":!0,unless:!0,"with":!0,log:!0,lookup:!0};if(r)for(var i in r)i in r&&(n.knownHelpers[i]=r[i]);return this.accept(t)},compileProgram:function(t){var n=new this.compiler,r=n.compile(t,this.options),i=this.guid++;return this.usePartial=this.usePartial||r.usePartial,this.children[i]=r,this.useDepths=this.useDepths||r.useDepths,i},accept:function(t){this.sourceNode.unshift(t);var n=this[t.type](t);return this.sourceNode.shift(),n},Program:function(t){this.options.blockParams.unshift(t.blockParams);var n=t.body,r=n.length;for(var i=0;i<r;i++)this.accept(n[i]);return this.options.blockParams.shift(),this.isSimple=r===1,this.blockParams=t.blockParams?t.blockParams.length:0,this},BlockStatement:function(t){d(t);var n=t.program,r=t.inverse;n=n&&this.compileProgram(n),r=r&&this.compileProgram(r);var i=this.classifySexpr(t);i==="helper"?this.helperSexpr(t,n,r):i==="simple"?(this.simpleSexpr(t),this.opcode("pushProgram",n),this.opcode("pushProgram",r),this.opcode("emptyHash"),this.opcode("blockValue",t.path.original)):(this.ambiguousSexpr(t,n,r),this.opcode("pushProgram",n),this.opcode("pushProgram",r),this.opcode("emptyHash"),this.opcode("ambiguousBlockValue")),this.opcode("append")},PartialStatement:function(t){this.usePartial=!0;var n=t.params;if(n.length>1)throw new s["default"]("Unsupported number of partial arguments: "+n.length,t);n.length||n.push({type:"PathExpression",parts:[],depth:0});var r=t.name.original,i=t.name.type==="SubExpression";i&&this.accept(t.name),this.setupFullMustacheParams(t,undefined,undefined,!0);var o=t.indent||"";this.options.preventIndent&&o&&(this.opcode("appendContent",o),o=""),this.opcode("invokePartial",i,r,o),this.opcode("append")},MustacheStatement:function(t){this.SubExpression(t),t.escaped&&!this.options.noEscape?this.opcode("appendEscaped"):this.opcode("append")},ContentStatement:function(t){t.value&&this.opcode("appendContent",t.value)},CommentStatement:function(){},SubExpression:function(t){d(t);var n=this.classifySexpr(t);n==="simple"?this.simpleSexpr(t):n==="helper"?this.helperSexpr(t):this.ambiguousSexpr(t)},ambiguousSexpr:function(t,n,r){var i=t.path,s=i.parts[0],o=n!=null||r!=null;this.opcode("getContext",i.depth),this.opcode("pushProgram",n),this.opcode("pushProgram",r),this.accept(i),this.opcode("invokeAmbiguous",s,o)},simpleSexpr:function(t){this.accept(t.path),this.opcode("resolvePossibleLambda")},helperSexpr:function(t,n,r){var i=this.setupFullMustacheParams(t,n,r),o=t.path,u=o.parts[0];if(this.options.knownHelpers[u])this.opcode("invokeKnownHelper",i.length,u);else{if(this.options.knownHelpersOnly)throw new s["default"]("You specified knownHelpersOnly, but used the unknown helper "+u,t);o.falsy=!0,this.accept(o),this.opcode("invokeHelper",i.length,o.original,a["default"].helpers.simpleId(o))}},PathExpression:function(t){this.addDepth(t.depth),this.opcode("getContext",t.depth);var n=t.parts[0],r=a["default"].helpers.scopedId(t),i=!t.depth&&!r&&this.blockParamIndex(n);i?this.opcode("lookupBlockParam",i,t.parts):n?t.data?(this.options.data=!0,this.opcode("lookupData",t.depth,t.parts)):this.opcode("lookupOnContext",t.parts,t.falsy,r):this.opcode("pushContext")},StringLiteral:function(t){this.opcode("pushString",t.value)},NumberLiteral:function(t){this.opcode("pushLiteral",t.value)},BooleanLiteral:function(t){this.opcode("pushLiteral",t.value)},UndefinedLiteral:function(){this.opcode("pushLiteral","undefined")},NullLiteral:function(){this.opcode("pushLiteral","null")},Hash:function(t){var n=t.pairs,r=0,i=n.length;this.opcode("pushHash");for(;r<i;r++)this.pushParam(n[r].value);while(r--)this.opcode("assignToHash",n[r].key);this.opcode("popHash")},opcode:function(t){this.opcodes.push({opcode:t,args:f.call(arguments,1),loc:this.sourceNode[0].loc})},addDepth:function(t){if(!t)return;this.useDepths=!0},classifySexpr:function(t){var n=a["default"].helpers.simpleId(t.path),r=n&&!!this.blockParamIndex(t.path.parts[0]),i=!r&&a["default"].helpers.helperExpression(t),s=!r&&(i||n);if(s&&!i){var o=t.path.parts[0],u=this.options;u.knownHelpers[o]?i=!0:u.knownHelpersOnly&&(s=!1)}return i?"helper":s?"ambiguous":"simple"},pushParams:function(t){for(var n=0,r=t.length;n<r;n++)this.pushParam(t[n])},pushParam:function(t){var n=t.value!=null?t.value:t.original||"";if(this.stringParams)n.replace&&(n=n.replace(/^(\.?\.\/)*/g,"").replace(/\//g,".")),t.depth&&this.addDepth(t.depth),this.opcode("getContext",t.depth||0),this.opcode("pushStringParam",n,t.type),t.type==="SubExpression"&&this.accept(t);else{if(this.trackIds){var r=undefined;t.parts&&!a["default"].helpers.scopedId(t)&&!t.depth&&(r=this.blockParamIndex(t.parts[0]));if(r){var i=t.parts.slice(1).join(".");this.opcode("pushId","BlockParam",r,i)}else n=t.original||n,n.replace&&(n=n.replace(/^\.\//g,"").replace(/^\.$/g,"")),this.opcode("pushId",t.type,n)}this.accept(t)}},setupFullMustacheParams:function(t,n,r,i){var s=t.params;return this.pushParams(s),this.opcode("pushProgram",n),this.opcode("pushProgram",r),t.hash?this.accept(t.hash):this.opcode("emptyHash",i),s},blockParamIndex:function(t){for(var n=0,r=this.options.blockParams.length;n<r;n++){var i=this.options.blockParams[n],s=i&&o.indexOf(i,t);if(i&&s>=0)return[n,s]}}}},function(e,t,n){"use strict";function l(e){this.value=e}function c(){}function h(e,t,n,r){var i=t.popStack(),s=0,o=n.length;e&&o--;for(;s<o;s++)i=t.nameLookup(i,n[s],r);return e?[t.aliasable("this.strict"),"(",i,", ",t.quotedString(n[s]),")"]:i}var r=n(8)["default"];t.__esModule=!0;var i=n(9),s=n(11),o=r(s),u=n(12),a=n(17),f=r(a);c.prototype={nameLookup:function(t,n){return c.isValidJavaScriptVariableName(n)?[t,".",n]:[t,"['",n,"']"]},depthedLookup:function(t){return[this.aliasable("this.lookup"),'(depths, "',t,'")']},compilerInfo:function(){var t=i.COMPILER_REVISION,n=i.REVISION_CHANGES[t];return[t,n]},appendToBuffer:function(t,n,r){return u.isArray(t)||(t=[t]),t=this.source.wrap(t,n),this.environment.isSimple?["return ",t,";"]:r?["buffer += ",t,";"]:(t.appendToBuffer=!0,t)},initializeBuffer:function(){return this.quotedString("")},compile:function(t,n,r,i){this.environment=t,this.options=n,this.stringParams=this.options.stringParams,this.trackIds=this.options.trackIds,this.precompile=!i,this.name=this.environment.name,this.isChild=!!r,this.context=r||{programs:[],environments:[]},this.preamble(),this.stackSlot=0,this.stackVars=[],this.aliases={},this.registers={list:[]},this.hashes=[],this.compileStack=[],this.inlineStack=[],this.blockParams=[],this.compileChildren(t,n),this.useDepths=this.useDepths||t.useDepths||this.options.compat,this.useBlockParams=this.useBlockParams||t.useBlockParams;var s=t.opcodes,u=undefined,a=undefined,f=undefined,l=undefined;for(f=0,l=s.length;f<l;f++)u=s[f],this.source.currentLocation=u.loc,a=a||u.loc,this[u.opcode].apply(this,u.args);this.source.currentLocation=a,this.pushSource("");if(this.stackSlot||this.inlineStack.length||this.compileStack.length)throw new o["default"]("Compile completed with content left on stack");var c=this.createFunctionContext(i);if(!this.isChild){var h={compiler:this.compilerInfo(),main:c},p=this.context.programs;for(f=0,l=p.length;f<l;f++)p[f]&&(h[f]=p[f]);return this.environment.usePartial&&(h.usePartial=!0),this.options.data&&(h.useData=!0),this.useDepths&&(h.useDepths=!0),this.useBlockParams&&(h.useBlockParams=!0),this.options.compat&&(h.compat=!0),i?h.compilerOptions=this.options:(h.compiler=JSON.stringify(h.compiler),this.source.currentLocation={start:{line:1,column:0}},h=this.objectLiteral(h),n.srcName?(h=h.toStringWithSourceMap({file:n.destName}),h.map=h.map&&h.map.toString()):h=h.toString()),h}return c},preamble:function(){this.lastContext=0,this.source=new f["default"](this.options.srcName)},createFunctionContext:function(t){var n="",r=this.stackVars.concat(this.registers.list);r.length>0&&(n+=", "+r.join(", "));var i=0;for(var s in this.aliases){var o=this.aliases[s];this.aliases.hasOwnProperty(s)&&o.children&&o.referenceCount>1&&(n+=", alias"+ ++i+"="+s,o.children[0]="alias"+i)}var u=["depth0","helpers","partials","data"];(this.useBlockParams||this.useDepths)&&u.push("blockParams"),this.useDepths&&u.push("depths");var a=this.mergeSource(n);return t?(u.push(a),Function.apply(this,u)):this.source.wrap(["function(",u.join(","),") {\n  ",a,"}"])},mergeSource:function(t){var n=this.environment.isSimple,r=!this.forceBuffer,i=undefined,s=undefined,o=undefined,u=undefined;return this.source.each(function(e){e.appendToBuffer?(o?e.prepend("  + "):o=e,u=e):(o&&(s?o.prepend("buffer += "):i=!0,u.add(";"),o=u=undefined),s=!0,n||(r=!1))}),r?o?(o.prepend("return "),u.add(";")):s||this.source.push('return "";'):(t+=", buffer = "+(i?"":this.initializeBuffer()),o?(o.prepend("return buffer + "),u.add(";")):this.source.push("return buffer;")),t&&this.source.prepend("var "+t.substring(2)+(i?"":";\n")),this.source.merge()},blockValue:function(t){var n=this.aliasable("helpers.blockHelperMissing"),r=[this.contextName(0)];this.setupHelperArgs(t,0,r);var i=this.popStack();r.splice(1,0,i),this.push(this.source.functionCall(n,"call",r))},ambiguousBlockValue:function(){var t=this.aliasable("helpers.blockHelperMissing"),n=[this.contextName(0)];this.setupHelperArgs("",0,n,!0),this.flushInline();var r=this.topStack();n.splice(1,0,r),this.pushSource(["if (!",this.lastHelper,") { ",r," = ",this.source.functionCall(t,"call",n),"}"])},appendContent:function(t){this.pendingContent?t=this.pendingContent+t:this.pendingLocation=this.source.currentLocation,this.pendingContent=t},append:function(){if(this.isInline())this.replaceStack(function(e){return[" != null ? ",e,' : ""']}),this.pushSource(this.appendToBuffer(this.popStack()));else{var t=this.popStack();this.pushSource(["if (",t," != null) { ",this.appendToBuffer(t,undefined,!0)," }"]),this.environment.isSimple&&this.pushSource(["else { ",this.appendToBuffer("''",undefined,!0)," }"])}},appendEscaped:function(){this.pushSource(this.appendToBuffer([this.aliasable("this.escapeExpression"),"(",this.popStack(),")"]))},getContext:function(t){this.lastContext=t},pushContext:function(){this.pushStackLiteral(this.contextName(this.lastContext))},lookupOnContext:function(t,n,r){var i=0;!r&&this.options.compat&&!this.lastContext?this.push(this.depthedLookup(t[i++])):this.pushContext(),this.resolvePath("context",t,i,n)},lookupBlockParam:function(t,n){this.useBlockParams=!0,this.push(["blockParams[",t[0],"][",t[1],"]"]),this.resolvePath("context",n,1)},lookupData:function(t,n){t?this.pushStackLiteral("this.data(data, "+t+")"):this.pushStackLiteral("data"),this.resolvePath("data",n,0,!0)},resolvePath:function(t,n,r,i){var s=this;if(this.options.strict||this.options.assumeObjects){this.push(h(this.options.strict,this,n,t));return}var o=n.length;for(;r<o;r++)this.replaceStack(function(e){var o=s.nameLookup(e,n[r],t);return i?[" && ",o]:[" != null ? ",o," : ",e]})},resolvePossibleLambda:function(){this.push([this.aliasable("this.lambda"),"(",this.popStack(),", ",this.contextName(0),")"])},pushStringParam:function(t,n){this.pushContext(),this.pushString(n),n!=="SubExpression"&&(typeof t=="string"?this.pushString(t):this.pushStackLiteral(t))},emptyHash:function(t){this.trackIds&&this.push("{}"),this.stringParams&&(this.push("{}"),this.push("{}")),this.pushStackLiteral(t?"undefined":"{}")},pushHash:function(){this.hash&&this.hashes.push(this.hash),this.hash={values:[],types:[],contexts:[],ids:[]}},popHash:function(){var t=this.hash;this.hash=this.hashes.pop(),this.trackIds&&this.push(this.objectLiteral(t.ids)),this.stringParams&&(this.push(this.objectLiteral(t.contexts)),this.push(this.objectLiteral(t.types))),this.push(this.objectLiteral(t.values))},pushString:function(t){this.pushStackLiteral(this.quotedString(t))},pushLiteral:function(t){this.pushStackLiteral(t)},pushProgram:function(t){t!=null?this.pushStackLiteral(this.programExpression(t)):this.pushStackLiteral(null)},invokeHelper:function(t,n,r){var i=this.popStack(),s=this.setupHelper(t,n),o=r?[s.name," || "]:"",u=["("].concat(o,i);this.options.strict||u.push(" || ",this.aliasable("helpers.helperMissing")),u.push(")"),this.push(this.source.functionCall(u,"call",s.callParams))},invokeKnownHelper:function(t,n){var r=this.setupHelper(t,n);this.push(this.source.functionCall(r.name,"call",r.callParams))},invokeAmbiguous:function(t,n){this.useRegister("helper");var r=this.popStack();this.emptyHash();var i=this.setupHelper(0,t,n),s=this.lastHelper=this.nameLookup("helpers",t,"helper"),o=["(","(helper = ",s," || ",r,")"];this.options.strict||(o[0]="(helper = ",o.push(" != null ? helper : ",this.aliasable("helpers.helperMissing"))),this.push(["(",o,i.paramsInit?["),(",i.paramsInit]:[],"),","(typeof helper === ",this.aliasable('"function"')," ? ",this.source.functionCall("helper","call",i.callParams)," : helper))"])},invokePartial:function(t,n,r){var i=[],s=this.setupParams(n,1,i,!1);t&&(n=this.popStack(),delete s.name),r&&(s.indent=JSON.stringify(r)),s.helpers="helpers",s.partials="partials",t?i.unshift(n):i.unshift(this.nameLookup("partials",n,"partial")),this.options.compat&&(s.depths="depths"),s=this.objectLiteral(s),i.push(s),this.push(this.source.functionCall("this.invokePartial","",i))},assignToHash:function(t){var n=this.popStack(),r=undefined,i=undefined,s=undefined;this.trackIds&&(s=this.popStack()),this.stringParams&&(i=this.popStack(),r=this.popStack());var o=this.hash;r&&(o.contexts[t]=r),i&&(o.types[t]=i),s&&(o.ids[t]=s),o.values[t]=n},pushId:function(t,n,r){t==="BlockParam"?this.pushStackLiteral("blockParams["+n[0]+"].path["+n[1]+"]"+(r?" + "+JSON.stringify("."+r):"")):t==="PathExpression"?this.pushString(n):t==="SubExpression"?this.pushStackLiteral("true"):this.pushStackLiteral("null")},compiler:c,compileChildren:function(t,n){var r=t.children,i=undefined,s=undefined;for(var o=0,u=r.length;o<u;o++){i=r[o],s=new this.compiler;var a=this.matchExistingProgram(i);a==null?(this.context.programs.push(""),a=this.context.programs.length,i.index=a,i.name="program"+a,this.context.programs[a]=s.compile(i,n,this.context,!this.precompile),this.context.environments[a]=i,this.useDepths=this.useDepths||s.useDepths,this.useBlockParams=this.useBlockParams||s.useBlockParams):(i.index=a,i.name="program"+a,this.useDepths=this.useDepths||i.useDepths,this.useBlockParams=this.useBlockParams||i.useBlockParams)}},matchExistingProgram:function(t){for(var n=0,r=this.context.environments.length;n<r;n++){var i=this.context.environments[n];if(i&&i.equals(t))return n}},programExpression:function(t){var n=this.environment.children[t],r=[n.index,"data",n.blockParams];return(this.useBlockParams||this.useDepths)&&r.push("blockParams"),this.useDepths&&r.push("depths"),"this.program("+r.join(", ")+")"},useRegister:function(t){this.registers[t]||(this.registers[t]=!0,this.registers.list.push(t))},push:function(t){return t instanceof l||(t=this.source.wrap(t)),this.inlineStack.push(t),t},pushStackLiteral:function(t){this.push(new l(t))},pushSource:function(t){this.pendingContent&&(this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent),this.pendingLocation)),this.pendingContent=undefined),t&&this.source.push(t)},replaceStack:function(t){var n=["("],r=undefined,i=undefined,s=undefined;if(!this.isInline())throw new o["default"]("replaceStack on non-inline");var u=this.popStack(!0);if(u instanceof l)r=[u.value],n=["(",r],s=!0;else{i=!0;var a=this.incrStack();n=["((",this.push(a)," = ",u,")"],r=this.topStack()}var f=t.call(this,r);s||this.popStack(),i&&this.stackSlot--,this.push(n.concat(f,")"))},incrStack:function(){return this.stackSlot++,this.stackSlot>this.stackVars.length&&this.stackVars.push("stack"+this.stackSlot),this.topStackName()},topStackName:function(){return"stack"+this.stackSlot},flushInline:function(){var t=this.inlineStack;this.inlineStack=[];for(var n=0,r=t.length;n<r;n++){var i=t[n];if(i instanceof l)this.compileStack.push(i);else{var s=this.incrStack();this.pushSource([s," = ",i,";"]),this.compileStack.push(s)}}},isInline:function(){return this.inlineStack.length},popStack:function(t){var n=this.isInline(),r=(n?this.inlineStack:this.compileStack).pop();if(!t&&r instanceof l)return r.value;if(!n){if(!this.stackSlot)throw new o["default"]("Invalid stack pop");this.stackSlot--}return r},topStack:function(){var t=this.isInline()?this.inlineStack:this.compileStack,n=t[t.length-1];return n instanceof l?n.value:n},contextName:function(t){return this.useDepths&&t?"depths["+t+"]":"depth"+t},quotedString:function(t){return this.source.quotedString(t)},objectLiteral:function(t){return this.source.objectLiteral(t)},aliasable:function(t){var n=this.aliases[t];return n?(n.referenceCount++,n):(n=this.aliases[t]=this.source.wrap(t),n.aliasable=!0,n.referenceCount=1,n)},setupHelper:function(t,n,r){var i=[],s=this.setupHelperArgs(n,t,i,r),o=this.nameLookup("helpers",n,"helper");return{params:i,paramsInit:s,name:o,callParams:[this.contextName(0)].concat(i)}},setupParams:function(t,n,r){var i={},s=[],o=[],u=[],a=undefined;i.name=this.quotedString(t),i.hash=this.popStack(),this.trackIds&&(i.hashIds=this.popStack()),this.stringParams&&(i.hashTypes=this.popStack(),i.hashContexts=this.popStack());var f=this.popStack(),l=this.popStack();if(l||f)i.fn=l||"this.noop",i.inverse=f||"this.noop";var c=n;while(c--)a=this.popStack(),r[c]=a,this.trackIds&&(u[c]=this.popStack()),this.stringParams&&(o[c]=this.popStack(),s[c]=this.popStack());return this.trackIds&&(i.ids=this.source.generateArray(u)),this.stringParams&&(i.types=this.source.generateArray(o),i.contexts=this.source.generateArray(s)),this.options.data&&(i.data="data"),this.useBlockParams&&(i.blockParams="blockParams"),i},setupHelperArgs:function(t,n,r,i){var s=this.setupParams(t,n,r,!0);return s=this.objectLiteral(s),i?(this.useRegister("options"),r.push("options"),["options=",s]):(r.push(s),"")}},function(){var e="break else new var case finally return void catch for switch while continue function this with default if throw delete in try do instanceof typeof abstract enum int short boolean export interface static byte extends long super char final native synchronized class float package throws const goto private transient debugger implements protected volatile double import public let yield await null true false".split(" "),t=c.RESERVED_WORDS={};for(var n=0,r=e.length;n<r;n++)t[e[n]]=!0}(),c.isValidJavaScriptVariableName=function(e){return!c.RESERVED_WORDS[e]&&/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(e)},t["default"]=c,e.exports=t["default"]},function(e,t,n){"use strict";function a(){this.parents=[]}var r=n(8)["default"];t.__esModule=!0;var i=n(11),s=r(i),o=n(2),u=r(o);a.prototype={constructor:a,mutating:!1,acceptKey:function(t,n){var r=this.accept(t[n]);if(this.mutating){if(r&&(!r.type||!u["default"][r.type]))throw new s["default"]('Unexpected node type "'+r.type+'" found when accepting '+n+" on "+t.type);t[n]=r}},acceptRequired:function(t,n){this.acceptKey(t,n);if(!t[n])throw new s["default"](t.type+" requires "+n)},acceptArray:function(t){for(var n=0,r=t.length;n<r;n++)this.acceptKey(t,n),t[n]||(t.splice(n,1),n--,r--)},accept:function(t){if(!t)return;this.current&&this.parents.unshift(this.current),this.current=t;var n=this[t.type](t);this.current=this.parents.shift();if(!this.mutating||n)return n;if(n!==!1)return t},Program:function(t){this.acceptArray(t.body)},MustacheStatement:function(t){this.acceptRequired(t,"path"),this.acceptArray(t.params),this.acceptKey(t,"hash")},BlockStatement:function(t){this.acceptRequired(t,"path"),this.acceptArray(t.params),this.acceptKey(t,"hash"),this.acceptKey(t,"program"),this.acceptKey(t,"inverse")},PartialStatement:function(t){this.acceptRequired(t,"name"),this.acceptArray(t.params),this.acceptKey(t,"hash")},ContentStatement:function(){},CommentStatement:function(){},SubExpression:function(t){this.acceptRequired(t,"path"),this.acceptArray(t.params),this.acceptKey(t,"hash")},PathExpression:function(){},StringLiteral:function(){},NumberLiteral:function(){},BooleanLiteral:function(){},UndefinedLiteral:function(){},NullLiteral:function(){},Hash:function(t){this.acceptArray(t.pairs)},HashPair:function(t){this.acceptRequired(t,"value")}},t["default"]=a,e.exports=t["default"]},function(e,t,n){(function(n){"use strict";t.__esModule=!0,t["default"]=function(e){var t=typeof n!="undefined"?n:window,r=t.Handlebars;e.noConflict=function(){t.Handlebars===e&&(t.Handlebars=r)}},e.exports=t["default"]}).call(t,function(){return this}())},function(e,t,n){"use strict";t["default"]=function(e){return e&&e.__esModule?e:{"default":e}},t.__esModule=!0},function(e,t,n){"use strict";function v(e,t){this.helpers=e||{},this.partials=t||{},m(this)}function m(e){e.registerHelper("helperMissing",function(){if(arguments.length===1)return undefined;throw new u["default"]('Missing helper: "'+arguments[arguments.length-1].name+'"')}),e.registerHelper("blockHelperMissing",function(t,n){var r=n.inverse,i=n.fn;if(t===!0)return i(this);if(t===!1||t==null)return r(this);if(c(t))return t.length>0?(n.ids&&(n.ids=[n.name]),e.helpers.each(t,n)):r(this);if(n.data&&n.ids){var o=b(n.data);o.contextPath=s.appendContextPath(n.data.contextPath,n.name),n={data:o}}return i(t,n)}),e.registerHelper("each",function(e,t){function l(t,r,i){a&&(a.key=t,a.index=r,a.first=r===0,a.last=!!i,f&&(a.contextPath=f+t)),o+=n(e[t],{data:a,blockParams:s.blockParams([e[t],t],[f+t,null])})}if(!t)throw new u["default"]("Must pass iterator to #each");var n=t.fn,r=t.inverse,i=0,o="",a=undefined,f=undefined;t.data&&t.ids&&(f=s.appendContextPath(t.data.contextPath,t.ids[0])+"."),h(e)&&(e=e.call(this)),t.data&&(a=b(t.data));if(e&&typeof e=="object")if(c(e))for(var p=e.length;i<p;i++)l(i,i,i===e.length-1);else{var d=undefined;for(var v in e)e.hasOwnProperty(v)&&(d&&l(d,i-1),d=v,i++);d&&l(d,i-1,!0)}return i===0&&(o=r(this)),o}),e.registerHelper("if",function(e,t){return h(e)&&(e=e.call(this)),!t.hash.includeZero&&!e||s.isEmpty(e)?t.inverse(this):t.fn(this)}),e.registerHelper("unless",function(t,n){return e.helpers["if"].call(this,t,{fn:n.inverse,inverse:n.fn,hash:n.hash})}),e.registerHelper("with",function(e,t){h(e)&&(e=e.call(this));var n=t.fn;if(!s.isEmpty(e)){if(t.data&&t.ids){var r=b(t.data);r.contextPath=s.appendContextPath(t.data.contextPath,t.ids[0]),t={data:r}}return n(e,t)}return t.inverse(this)}),e.registerHelper("log",function(t,n){var r=n.data&&n.data.level!=null?parseInt(n.data.level,10):1;e.log(r,t)}),e.registerHelper("lookup",function(e,t){return e&&e[t]})}function b(e){var t=s.extend({},e);return t._parent=e,t}var r=n(8)["default"];t.__esModule=!0,t.HandlebarsEnvironment=v,t.createFrame=b;var i=n(12),s=r(i),o=n(11),u=r(o),a="3.0.1";t.VERSION=a;var f=6;t.COMPILER_REVISION=f;var l={1:"<= 1.0.rc.2",2:"== 1.0.0-rc.3",3:"== 1.0.0-rc.4",4:"== 1.x.x",5:"== 2.0.0-alpha.x",6:">= 2.0.0-beta.1"};t.REVISION_CHANGES=l;var c=s.isArray,h=s.isFunction,p=s.toString,d="[object Object]";v.prototype={constructor:v,logger:g,log:y,registerHelper:function(t,n){if(p.call(t)===d){if(n)throw new u["default"]("Arg not supported with multiple helpers");s.extend(this.helpers,t)}else this.helpers[t]=n},unregisterHelper:function(t){delete this.helpers[t]},registerPartial:function(t,n){if(p.call(t)===d)s.extend(this.partials,t);else{if(typeof n=="undefined")throw new u["default"]("Attempting to register a partial as undefined");this.partials[t]=n}},unregisterPartial:function(t){delete this.partials[t]}};var g={methodMap:{0:"debug",1:"info",2:"warn",3:"error"},DEBUG:0,INFO:1,WARN:2,ERROR:3,level:1,log:function(t,n){if(typeof console!="undefined"&&g.level<=t){var r=g.methodMap[t];(console[r]||console.log).call(console,n)}}};t.logger=g;var y=g.log;t.log=y},function(e,t,n){"use strict";function r(e){this.string=e}t.__esModule=!0,r.prototype.toString=r.prototype.toHTML=function(){return""+this.string},t["default"]=r,e.exports=t["default"]},function(e,t,n){"use strict";function i(e,t){var n=t&&t.loc,s=undefined,o=undefined;n&&(s=n.start.line,o=n.start.column,e+=" - "+s+":"+o);var u=Error.prototype.constructor.call(this,e);for(var a=0;a<r.length;a++)this[r[a]]=u[r[a]];Error.captureStackTrace&&Error.captureStackTrace(this,i),n&&(this.lineNumber=s,this.column=o)}t.__esModule=!0;var r=["description","fileName","lineNumber","message","name","number","stack"];i.prototype=new Error,t["default"]=i,e.exports=t["default"]},function(e,t,n){"use strict";function o(e){return r[e]}function u(e){for(var t=1;t<arguments.length;t++)for(var n in arguments[t])Object.prototype.hasOwnProperty.call(arguments[t],n)&&(e[n]=arguments[t][n]);return e}function c(e,t){for(var n=0,r=e.length;n<r;n++)if(e[n]===t)return n;return-1}function h(e){if(typeof e!="string"){if(e&&e.toHTML)return e.toHTML();if(e==null)return"";if(!e)return e+"";e=""+e}return s.test(e)?e.replace(i,o):e}function p(e){return!e&&e!==0?!0:l(e)&&e.length===0?!0:!1}function d(e,t){return e.path=t,e}function v(e,t){return(e?e+".":"")+t}t.__esModule=!0,t.extend=u,t.indexOf=c,t.escapeExpression=h,t.isEmpty=p,t.blockParams=d,t.appendContextPath=v;var r={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","`":"&#x60;"},i=/[&<>"'`]/g,s=/[&<>"'`]/,a=Object.prototype.toString;t.toString=a;var f=function(t){return typeof t=="function"};f(/x/)&&(t.isFunction=f=function(e){return typeof e=="function"&&a.call(e)==="[object Function]"});var f;t.isFunction=f;var l=Array.isArray||function(e){return e&&typeof e=="object"?a.call(e)==="[object Array]":!1};t.isArray=l},function(e,t,n){"use strict";function f(e){var t=e&&e[0]||1,n=a.COMPILER_REVISION;if(t!==n){if(t<n){var r=a.REVISION_CHANGES[n],i=a.REVISION_CHANGES[t];throw new u["default"]("Template was precompiled with an older version of Handlebars than the current runtime. Please update your precompiler to a newer version ("+r+") or downgrade your runtime to an older version ("+i+").")}throw new u["default"]("Template was precompiled with a newer version of Handlebars than the current runtime. Please update your runtime to a newer version ("+e[1]+").")}}function l(e,t){function n(n,r,i){i.hash&&(r=s.extend({},r,i.hash)),n=t.VM.resolvePartial.call(this,n,r,i);var o=t.VM.invokePartial.call(this,n,r,i);o==null&&t.compile&&(i.partials[i.name]=t.compile(n,e.compilerOptions,t),o=i.partials[i.name](r,i));if(o!=null){if(i.indent){var a=o.split("\n");for(var f=0,l=a.length;f<l;f++){if(!a[f]&&f+1===l)break;a[f]=i.indent+a[f]}o=a.join("\n")}return o}throw new u["default"]("The partial "+i.name+" could not be compiled when running in runtime-only mode")}function i(t){var n=arguments[1]===undefined?{}:arguments[1],s=n.data;i._setup(n),!n.partial&&e.useData&&(s=v(t,s));var o=undefined,u=e.useBlockParams?[]:undefined;return e.useDepths&&(o=n.depths?[t].concat(n.depths):[t]),e.main.call(r,t,r.helpers,r.partials,s,u,o)}if(!t)throw new u["default"]("No environment passed to template");if(!e||!e.main)throw new u["default"]("Unknown template object: "+typeof e);t.VM.checkRevision(e.compiler);var r={strict:function(t,n){if(n in t)return t[n];throw new u["default"]('"'+n+'" not defined in '+t)},lookup:function(t,n){var r=t.length;for(var i=0;i<r;i++)if(t[i]&&t[i][n]!=null)return t[i][n]},lambda:function(t,n){return typeof t=="function"?t.call(n):t},escapeExpression:s.escapeExpression,invokePartial:n,fn:function(n){return e[n]},programs:[],program:function(t,n,r,i,s){var o=this.programs[t],u=this.fn(t);return n||s||i||r?o=c(this,t,u,n,r,i,s):o||(o=this.programs[t]=c(this,t,u)),o},data:function(t,n){while(t&&n--)t=t._parent;return t},merge:function(t,n){var r=t||n;return t&&n&&t!==n&&(r=s.extend({},n,t)),r},noop:t.VM.noop,compilerInfo:e.compiler};return i.isTop=!0,i._setup=function(n){n.partial?(r.helpers=n.helpers,r.partials=n.partials):(r.helpers=r.merge(n.helpers,t.helpers),e.usePartial&&(r.partials=r.merge(n.partials,t.partials)))},i._child=function(t,n,i,s){if(e.useBlockParams&&!i)throw new u["default"]("must pass block params");if(e.useDepths&&!s)throw new u["default"]("must pass parent depths");return c(r,t,e[t],n,0,i,s)},i}function c(e,t,n,r,i,s,o){function u(t){var i=arguments[1]===undefined?{}:arguments[1];return n.call(e,t,e.helpers,e.partials,i.data||r,s&&[i.blockParams].concat(s),o&&[t].concat(o))}return u.program=t,u.depth=o?o.length:0,u.blockParams=i||0,u}function h(e,t,n){return e?!e.call&&!n.name&&(n.name=e,e=n.partials[e]):e=n.partials[n.name],e}function p(e,t,n){n.partial=!0;if(e===undefined)throw new u["default"]("The partial "+n.name+" could not be found");if(e instanceof Function)return e(t,n)}function d(){return""}function v(e,t){if(!t||!("root"in t))t=t?a.createFrame(t):{},t.root=e;return t}var r=n(8)["default"];t.__esModule=!0,t.checkRevision=f,t.template=l,t.wrapProgram=c,t.resolvePartial=h,t.invokePartial=p,t.noop=d;var i=n(12),s=r(i),o=n(11),u=r(o),a=n(9)},function(e,t,n){"use strict";t.__esModule=!0;var r=function(){function n(){this.yy={}}var e={trace:function(){},yy:{},symbols_:{error:2,root:3,program:4,EOF:5,program_repetition0:6,statement:7,mustache:8,block:9,rawBlock:10,partial:11,content:12,COMMENT:13,CONTENT:14,openRawBlock:15,END_RAW_BLOCK:16,OPEN_RAW_BLOCK:17,helperName:18,openRawBlock_repetition0:19,openRawBlock_option0:20,CLOSE_RAW_BLOCK:21,openBlock:22,block_option0:23,closeBlock:24,openInverse:25,block_option1:26,OPEN_BLOCK:27,openBlock_repetition0:28,openBlock_option0:29,openBlock_option1:30,CLOSE:31,OPEN_INVERSE:32,openInverse_repetition0:33,openInverse_option0:34,openInverse_option1:35,openInverseChain:36,OPEN_INVERSE_CHAIN:37,openInverseChain_repetition0:38,openInverseChain_option0:39,openInverseChain_option1:40,inverseAndProgram:41,INVERSE:42,inverseChain:43,inverseChain_option0:44,OPEN_ENDBLOCK:45,OPEN:46,mustache_repetition0:47,mustache_option0:48,OPEN_UNESCAPED:49,mustache_repetition1:50,mustache_option1:51,CLOSE_UNESCAPED:52,OPEN_PARTIAL:53,partialName:54,partial_repetition0:55,partial_option0:56,param:57,sexpr:58,OPEN_SEXPR:59,sexpr_repetition0:60,sexpr_option0:61,CLOSE_SEXPR:62,hash:63,hash_repetition_plus0:64,hashSegment:65,ID:66,EQUALS:67,blockParams:68,OPEN_BLOCK_PARAMS:69,blockParams_repetition_plus0:70,CLOSE_BLOCK_PARAMS:71,path:72,dataName:73,STRING:74,NUMBER:75,BOOLEAN:76,UNDEFINED:77,NULL:78,DATA:79,pathSegments:80,SEP:81,$accept:0,$end:1},terminals_:{2:"error",5:"EOF",13:"COMMENT",14:"CONTENT",16:"END_RAW_BLOCK",17:"OPEN_RAW_BLOCK",21:"CLOSE_RAW_BLOCK",27:"OPEN_BLOCK",31:"CLOSE",32:"OPEN_INVERSE",37:"OPEN_INVERSE_CHAIN",42:"INVERSE",45:"OPEN_ENDBLOCK",46:"OPEN",49:"OPEN_UNESCAPED",52:"CLOSE_UNESCAPED",53:"OPEN_PARTIAL",59:"OPEN_SEXPR",62:"CLOSE_SEXPR",66:"ID",67:"EQUALS",69:"OPEN_BLOCK_PARAMS",71:"CLOSE_BLOCK_PARAMS",74:"STRING",75:"NUMBER",76:"BOOLEAN",77:"UNDEFINED",78:"NULL",79:"DATA",81:"SEP"},productions_:[0,[3,2],[4,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[12,1],[10,3],[15,5],[9,4],[9,4],[22,6],[25,6],[36,6],[41,2],[43,3],[43,1],[24,3],[8,5],[8,5],[11,5],[57,1],[57,1],[58,5],[63,1],[65,3],[68,3],[18,1],[18,1],[18,1],[18,1],[18,1],[18,1],[18,1],[54,1],[54,1],[73,2],[72,1],[80,3],[80,1],[6,0],[6,2],[19,0],[19,2],[20,0],[20,1],[23,0],[23,1],[26,0],[26,1],[28,0],[28,2],[29,0],[29,1],[30,0],[30,1],[33,0],[33,2],[34,0],[34,1],[35,0],[35,1],[38,0],[38,2],[39,0],[39,1],[40,0],[40,1],[44,0],[44,1],[47,0],[47,2],[48,0],[48,1],[50,0],[50,2],[51,0],[51,1],[55,0],[55,2],[56,0],[56,1],[60,0],[60,2],[61,0],[61,1],[64,1],[64,2],[70,1],[70,2]],performAction:function(t,n,r,i,s,o,u){var a=o.length-1;switch(s){case 1:return o[a-1];case 2:this.$=new i.Program(o[a],null,{},i.locInfo(this._$));break;case 3:this.$=o[a];break;case 4:this.$=o[a];break;case 5:this.$=o[a];break;case 6:this.$=o[a];break;case 7:this.$=o[a];break;case 8:this.$=new i.CommentStatement(i.stripComment(o[a]),i.stripFlags(o[a],o[a]),i.locInfo(this._$));break;case 9:this.$=new i.ContentStatement(o[a],i.locInfo(this._$));break;case 10:this.$=i.prepareRawBlock(o[a-2],o[a-1],o[a],this._$);break;case 11:this.$={path:o[a-3],params:o[a-2],hash:o[a-1]};break;case 12:this.$=i.prepareBlock(o[a-3],o[a-2],o[a-1],o[a],!1,this._$);break;case 13:this.$=i.prepareBlock(o[a-3],o[a-2],o[a-1],o[a],!0,this._$);break;case 14:this.$={path:o[a-4],params:o[a-3],hash:o[a-2],blockParams:o[a-1],strip:i.stripFlags(o[a-5],o[a])};break;case 15:this.$={path:o[a-4],params:o[a-3],hash:o[a-2],blockParams:o[a-1],strip:i.stripFlags(o[a-5],o[a])};break;case 16:this.$={path:o[a-4],params:o[a-3],hash:o[a-2],blockParams:o[a-1],strip:i.stripFlags(o[a-5],o[a])};break;case 17:this.$={strip:i.stripFlags(o[a-1],o[a-1]),program:o[a]};break;case 18:var f=i.prepareBlock(o[a-2],o[a-1],o[a],o[a],!1,this._$),l=new i.Program([f],null,{},i.locInfo(this._$));l.chained=!0,this.$={strip:o[a-2].strip,program:l,chain:!0};break;case 19:this.$=o[a];break;case 20:this.$={path:o[a-1],strip:i.stripFlags(o[a-2],o[a])};break;case 21:this.$=i.prepareMustache(o[a-3],o[a-2],o[a-1],o[a-4],i.stripFlags(o[a-4],o[a]),this._$);break;case 22:this.$=i.prepareMustache(o[a-3],o[a-2],o[a-1],o[a-4],i.stripFlags(o[a-4],o[a]),this._$);break;case 23:this.$=new i.PartialStatement(o[a-3],o[a-2],o[a-1],i.stripFlags(o[a-4],o[a]),i.locInfo(this._$));break;case 24:this.$=o[a];break;case 25:this.$=o[a];break;case 26:this.$=new i.SubExpression(o[a-3],o[a-2],o[a-1],i.locInfo(this._$));break;case 27:this.$=new i.Hash(o[a],i.locInfo(this._$));break;case 28:this.$=new i.HashPair(i.id(o[a-2]),o[a],i.locInfo(this._$));break;case 29:this.$=i.id(o[a-1]);break;case 30:this.$=o[a];break;case 31:this.$=o[a];break;case 32:this.$=new i.StringLiteral(o[a],i.locInfo(this._$));break;case 33:this.$=new i.NumberLiteral(o[a],i.locInfo(this._$));break;case 34:this.$=new i.BooleanLiteral(o[a],i.locInfo(this._$));break;case 35:this.$=new i.UndefinedLiteral(i.locInfo(this._$));break;case 36:this.$=new i.NullLiteral(i.locInfo(this._$));break;case 37:this.$=o[a];break;case 38:this.$=o[a];break;case 39:this.$=i.preparePath(!0,o[a],this._$);break;case 40:this.$=i.preparePath(!1,o[a],this._$);break;case 41:o[a-2].push({part:i.id(o[a]),original:o[a],separator:o[a-1]}),this.$=o[a-2];break;case 42:this.$=[{part:i.id(o[a]),original:o[a]}];break;case 43:this.$=[];break;case 44:o[a-1].push(o[a]);break;case 45:this.$=[];break;case 46:o[a-1].push(o[a]);break;case 53:this.$=[];break;case 54:o[a-1].push(o[a]);break;case 59:this.$=[];break;case 60:o[a-1].push(o[a]);break;case 65:this.$=[];break;case 66:o[a-1].push(o[a]);break;case 73:this.$=[];break;case 74:o[a-1].push(o[a]);break;case 77:this.$=[];break;case 78:o[a-1].push(o[a]);break;case 81:this.$=[];break;case 82:o[a-1].push(o[a]);break;case 85:this.$=[];break;case 86:o[a-1].push(o[a]);break;case 89:this.$=[o[a]];break;case 90:o[a-1].push(o[a]);break;case 91:this.$=[o[a]];break;case 92:o[a-1].push(o[a])}},table:[{3:1,4:2,5:[2,43],6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],46:[2,43],49:[2,43],53:[2,43]},{1:[3]},{5:[1,4]},{5:[2,2],7:5,8:6,9:7,10:8,11:9,12:10,13:[1,11],14:[1,18],15:16,17:[1,21],22:14,25:15,27:[1,19],32:[1,20],37:[2,2],42:[2,2],45:[2,2],46:[1,12],49:[1,13],53:[1,17]},{1:[2,1]},{5:[2,44],13:[2,44],14:[2,44],17:[2,44],27:[2,44],32:[2,44],37:[2,44],42:[2,44],45:[2,44],46:[2,44],49:[2,44],53:[2,44]},{5:[2,3],13:[2,3],14:[2,3],17:[2,3],27:[2,3],32:[2,3],37:[2,3],42:[2,3],45:[2,3],46:[2,3],49:[2,3],53:[2,3]},{5:[2,4],13:[2,4],14:[2,4],17:[2,4],27:[2,4],32:[2,4],37:[2,4],42:[2,4],45:[2,4],46:[2,4],49:[2,4],53:[2,4]},{5:[2,5],13:[2,5],14:[2,5],17:[2,5],27:[2,5],32:[2,5],37:[2,5],42:[2,5],45:[2,5],46:[2,5],49:[2,5],53:[2,5]},{5:[2,6],13:[2,6],14:[2,6],17:[2,6],27:[2,6],32:[2,6],37:[2,6],42:[2,6],45:[2,6],46:[2,6],49:[2,6],53:[2,6]},{5:[2,7],13:[2,7],14:[2,7],17:[2,7],27:[2,7],32:[2,7],37:[2,7],42:[2,7],45:[2,7],46:[2,7],49:[2,7],53:[2,7]},{5:[2,8],13:[2,8],14:[2,8],17:[2,8],27:[2,8],32:[2,8],37:[2,8],42:[2,8],45:[2,8],46:[2,8],49:[2,8],53:[2,8]},{18:22,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:33,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{4:34,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],37:[2,43],42:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{4:35,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],42:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{12:36,14:[1,18]},{18:38,54:37,58:39,59:[1,40],66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{5:[2,9],13:[2,9],14:[2,9],16:[2,9],17:[2,9],27:[2,9],32:[2,9],37:[2,9],42:[2,9],45:[2,9],46:[2,9],49:[2,9],53:[2,9]},{18:41,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:42,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:43,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{31:[2,73],47:44,59:[2,73],66:[2,73],74:[2,73],75:[2,73],76:[2,73],77:[2,73],78:[2,73],79:[2,73]},{21:[2,30],31:[2,30],52:[2,30],59:[2,30],62:[2,30],66:[2,30],69:[2,30],74:[2,30],75:[2,30],76:[2,30],77:[2,30],78:[2,30],79:[2,30]},{21:[2,31],31:[2,31],52:[2,31],59:[2,31],62:[2,31],66:[2,31],69:[2,31],74:[2,31],75:[2,31],76:[2,31],77:[2,31],78:[2,31],79:[2,31]},{21:[2,32],31:[2,32],52:[2,32],59:[2,32],62:[2,32],66:[2,32],69:[2,32],74:[2,32],75:[2,32],76:[2,32],77:[2,32],78:[2,32],79:[2,32]},{21:[2,33],31:[2,33],52:[2,33],59:[2,33],62:[2,33],66:[2,33],69:[2,33],74:[2,33],75:[2,33],76:[2,33],77:[2,33],78:[2,33],79:[2,33]},{21:[2,34],31:[2,34],52:[2,34],59:[2,34],62:[2,34],66:[2,34],69:[2,34],74:[2,34],75:[2,34],76:[2,34],77:[2,34],78:[2,34],79:[2,34]},{21:[2,35],31:[2,35],52:[2,35],59:[2,35],62:[2,35],66:[2,35],69:[2,35],74:[2,35],75:[2,35],76:[2,35],77:[2,35],78:[2,35],79:[2,35]},{21:[2,36],31:[2,36],52:[2,36],59:[2,36],62:[2,36],66:[2,36],69:[2,36],74:[2,36],75:[2,36],76:[2,36],77:[2,36],78:[2,36],79:[2,36]},{21:[2,40],31:[2,40],52:[2,40],59:[2,40],62:[2,40],66:[2,40],69:[2,40],74:[2,40],75:[2,40],76:[2,40],77:[2,40],78:[2,40],79:[2,40],81:[1,45]},{66:[1,32],80:46},{21:[2,42],31:[2,42],52:[2,42],59:[2,42],62:[2,42],66:[2,42],69:[2,42],74:[2,42],75:[2,42],76:[2,42],77:[2,42],78:[2,42],79:[2,42],81:[2,42]},{50:47,52:[2,77],59:[2,77],66:[2,77],74:[2,77],75:[2,77],76:[2,77],77:[2,77],78:[2,77],79:[2,77]},{23:48,36:50,37:[1,52],41:51,42:[1,53],43:49,45:[2,49]},{26:54,41:55,42:[1,53],45:[2,51]},{16:[1,56]},{31:[2,81],55:57,59:[2,81],66:[2,81],74:[2,81],75:[2,81],76:[2,81],77:[2,81],78:[2,81],79:[2,81]},{31:[2,37],59:[2,37],66:[2,37],74:[2,37],75:[2,37],76:[2,37],77:[2,37],78:[2,37],79:[2,37]},{31:[2,38],59:[2,38],66:[2,38],74:[2,38],75:[2,38],76:[2,38],77:[2,38],78:[2,38],79:[2,38]},{18:58,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{28:59,31:[2,53],59:[2,53],66:[2,53],69:[2,53],74:[2,53],75:[2,53],76:[2,53],77:[2,53],78:[2,53],79:[2,53]},{31:[2,59],33:60,59:[2,59],66:[2,59],69:[2,59],74:[2,59],75:[2,59],76:[2,59],77:[2,59],78:[2,59],79:[2,59]},{19:61,21:[2,45],59:[2,45],66:[2,45],74:[2,45],75:[2,45],76:[2,45],77:[2,45],78:[2,45],79:[2,45]},{18:65,31:[2,75],48:62,57:63,58:66,59:[1,40],63:64,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{66:[1,70]},{21:[2,39],31:[2,39],52:[2,39],59:[2,39],62:[2,39],66:[2,39],69:[2,39],74:[2,39],75:[2,39],76:[2,39],77:[2,39],78:[2,39],79:[2,39],81:[1,45]},{18:65,51:71,52:[2,79],57:72,58:66,59:[1,40],63:73,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{24:74,45:[1,75]},{45:[2,50]},{4:76,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],37:[2,43],42:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{45:[2,19]},{18:77,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{4:78,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{24:79,45:[1,75]},{45:[2,52]},{5:[2,10],13:[2,10],14:[2,10],17:[2,10],27:[2,10],32:[2,10],37:[2,10],42:[2,10],45:[2,10],46:[2,10],49:[2,10],53:[2,10]},{18:65,31:[2,83],56:80,57:81,58:66,59:[1,40],63:82,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{59:[2,85],60:83,62:[2,85],66:[2,85],74:[2,85],75:[2,85],76:[2,85],77:[2,85],78:[2,85],79:[2,85]},{18:65,29:84,31:[2,55],57:85,58:66,59:[1,40],63:86,64:67,65:68,66:[1,69],69:[2,55],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:65,31:[2,61],34:87,57:88,58:66,59:[1,40],63:89,64:67,65:68,66:[1,69],69:[2,61],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:65,20:90,21:[2,47],57:91,58:66,59:[1,40],63:92,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{31:[1,93]},{31:[2,74],59:[2,74],66:[2,74],74:[2,74],75:[2,74],76:[2,74],77:[2,74],78:[2,74],79:[2,74]},{31:[2,76]},{21:[2,24],31:[2,24],52:[2,24],59:[2,24],62:[2,24],66:[2,24],69:[2,24],74:[2,24],75:[2,24],76:[2,24],77:[2,24],78:[2,24],79:[2,24]},{21:[2,25],31:[2,25],52:[2,25],59:[2,25],62:[2,25],66:[2,25],69:[2,25],74:[2,25],75:[2,25],76:[2,25],77:[2,25],78:[2,25],79:[2,25]},{21:[2,27],31:[2,27],52:[2,27],62:[2,27],65:94,66:[1,95],69:[2,27]},{21:[2,89],31:[2,89],52:[2,89],62:[2,89],66:[2,89],69:[2,89]},{21:[2,42],31:[2,42],52:[2,42],59:[2,42],62:[2,42],66:[2,42],67:[1,96],69:[2,42],74:[2,42],75:[2,42],76:[2,42],77:[2,42],78:[2,42],79:[2,42],81:[2,42]},{21:[2,41],31:[2,41],52:[2,41],59:[2,41],62:[2,41],66:[2,41],69:[2,41],74:[2,41],75:[2,41],76:[2,41],77:[2,41],78:[2,41],79:[2,41],81:[2,41]},{52:[1,97]},{52:[2,78],59:[2,78],66:[2,78],74:[2,78],75:[2,78],76:[2,78],77:[2,78],78:[2,78],79:[2,78]},{52:[2,80]},{5:[2,12],13:[2,12],14:[2,12],17:[2,12],27:[2,12],32:[2,12],37:[2,12],42:[2,12],45:[2,12],46:[2,12],49:[2,12],53:[2,12]},{18:98,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{36:50,37:[1,52],41:51,42:[1,53],43:100,44:99,45:[2,71]},{31:[2,65],38:101,59:[2,65],66:[2,65],69:[2,65],74:[2,65],75:[2,65],76:[2,65],77:[2,65],78:[2,65],79:[2,65]},{45:[2,17]},{5:[2,13],13:[2,13],14:[2,13],17:[2,13],27:[2,13],32:[2,13],37:[2,13],42:[2,13],45:[2,13],46:[2,13],49:[2,13],53:[2,13]},{31:[1,102]},{31:[2,82],59:[2,82],66:[2,82],74:[2,82],75:[2,82],76:[2,82],77:[2,82],78:[2,82],79:[2,82]},{31:[2,84]},{18:65,57:104,58:66,59:[1,40],61:103,62:[2,87],63:105,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{30:106,31:[2,57],68:107,69:[1,108]},{31:[2,54],59:[2,54],66:[2,54],69:[2,54],74:[2,54],75:[2,54],76:[2,54],77:[2,54],78:[2,54],79:[2,54]},{31:[2,56],69:[2,56]},{31:[2,63],35:109,68:110,69:[1,108]},{31:[2,60],59:[2,60],66:[2,60],69:[2,60],74:[2,60],75:[2,60],76:[2,60],77:[2,60],78:[2,60],79:[2,60]},{31:[2,62],69:[2,62]},{21:[1,111]},{21:[2,46],59:[2,46],66:[2,46],74:[2,46],75:[2,46],76:[2,46],77:[2,46],78:[2,46],79:[2,46]},{21:[2,48]},{5:[2,21],13:[2,21],14:[2,21],17:[2,21],27:[2,21],32:[2,21],37:[2,21],42:[2,21],45:[2,21],46:[2,21],49:[2,21],53:[2,21]},{21:[2,90],31:[2,90],52:[2,90],62:[2,90],66:[2,90],69:[2,90]},{67:[1,96]},{18:65,57:112,58:66,59:[1,40],66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{5:[2,22],13:[2,22],14:[2,22],17:[2,22],27:[2,22],32:[2,22],37:[2,22],42:[2,22],45:[2,22],46:[2,22],49:[2,22],53:[2,22]},{31:[1,113]},{45:[2,18]},{45:[2,72]},{18:65,31:[2,67],39:114,57:115,58:66,59:[1,40],63:116,64:67,65:68,66:[1,69],69:[2,67],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{5:[2,23],13:[2,23],14:[2,23],17:[2,23],27:[2,23],32:[2,23],37:[2,23],42:[2,23],45:[2,23],46:[2,23],49:[2,23],53:[2,23]},{62:[1,117]},{59:[2,86],62:[2,86],66:[2,86],74:[2,86],75:[2,86],76:[2,86],77:[2,86],78:[2,86],79:[2,86]},{62:[2,88]},{31:[1,118]},{31:[2,58]},{66:[1,120],70:119},{31:[1,121]},{31:[2,64]},{14:[2,11]},{21:[2,28],31:[2,28],52:[2,28],62:[2,28],66:[2,28],69:[2,28]},{5:[2,20],13:[2,20],14:[2,20],17:[2,20],27:[2,20],32:[2,20],37:[2,20],42:[2,20],45:[2,20],46:[2,20],49:[2,20],53:[2,20]},{31:[2,69],40:122,68:123,69:[1,108]},{31:[2,66],59:[2,66],66:[2,66],69:[2,66],74:[2,66],75:[2,66],76:[2,66],77:[2,66],78:[2,66],79:[2,66]},{31:[2,68],69:[2,68]},{21:[2,26],31:[2,26],52:[2,26],59:[2,26],62:[2,26],66:[2,26],69:[2,26],74:[2,26],75:[2,26],76:[2,26],77:[2,26],78:[2,26],79:[2,26]},{13:[2,14],14:[2,14],17:[2,14],27:[2,14],32:[2,14],37:[2,14],42:[2,14],45:[2,14],46:[2,14],49:[2,14],53:[2,14]},{66:[1,125],71:[1,124]},{66:[2,91],71:[2,91]},{13:[2,15],14:[2,15],17:[2,15],27:[2,15],32:[2,15],42:[2,15],45:[2,15],46:[2,15],49:[2,15],53:[2,15]},{31:[1,126]},{31:[2,70]},{31:[2,29]},{66:[2,92],71:[2,92]},{13:[2,16],14:[2,16],17:[2,16],27:[2,16],32:[2,16],37:[2,16],42:[2,16],45:[2,16],46:[2,16],49:[2,16],53:[2,16]}],defaultActions:{4:[2,1],49:[2,50],51:[2,19],55:[2,52],64:[2,76],73:[2,80],78:[2,17],82:[2,84],92:[2,48],99:[2,18],100:[2,72],105:[2,88],107:[2,58],110:[2,64],111:[2,11],123:[2,70],124:[2,29]},parseError:function(t,n){throw new Error(t)},parse:function(t){function v(e){r.length=r.length-2*e,i.length=i.length-e,s.length=s.length-e}function m(){var e;return e=n.lexer.lex()||1,typeof e!="number"&&(e=n.symbols_[e]||e),e}var n=this,r=[0],i=[null],s=[],o=this.table,u="",a=0,f=0,l=0,c=2,h=1;this.lexer.setInput(t),this.lexer.yy=this.yy,this.yy.lexer=this.lexer,this.yy.parser=this,typeof this.lexer.yylloc=="undefined"&&(this.lexer.yylloc={});var p=this.lexer.yylloc;s.push(p);var d=this.lexer.options&&this.lexer.options.ranges;typeof this.yy.parseError=="function"&&(this.parseError=this.yy.parseError);var g,y,b,w,E,S,x={},T,N,C,k;for(;;){b=r[r.length-1];if(this.defaultActions[b])w=this.defaultActions[b];else{if(g===null||typeof g=="undefined")g=m();w=o[b]&&o[b][g]}if(typeof w=="undefined"||!w.length||!w[0]){var L="";if(!l){k=[];for(T in o[b])this.terminals_[T]&&T>2&&k.push("'"+this.terminals_[T]+"'");this.lexer.showPosition?L="Parse error on line "+(a+1)+":\n"+this.lexer.showPosition()+"\nExpecting "+k.join(", ")+", got '"+(this.terminals_[g]||g)+"'":L="Parse error on line "+(a+1)+": Unexpected "+(g==1?"end of input":"'"+(this.terminals_[g]||g)+"'"),this.parseError(L,{text:this.lexer.match,token:this.terminals_[g]||g,line:this.lexer.yylineno,loc:p,expected:k})}}if(w[0]instanceof Array&&w.length>1)throw new Error("Parse Error: multiple actions possible at state: "+b+", token: "+g);switch(w[0]){case 1:r.push(g),i.push(this.lexer.yytext),s.push(this.lexer.yylloc),r.push(w[1]),g=null,y?(g=y,y=null):(f=this.lexer.yyleng,u=this.lexer.yytext,a=this.lexer.yylineno,p=this.lexer.yylloc,l>0&&l--);break;case 2:N=this.productions_[w[1]][1],x.$=i[i.length-N],x._$={first_line:s[s.length-(N||1)].first_line,last_line:s[s.length-1].last_line,first_column:s[s.length-(N||1)].first_column,last_column:s[s.length-1].last_column},d&&(x._$.range=[s[s.length-(N||1)].range[0],s[s.length-1].range[1]]),S=this.performAction.call(x,u,f,a,this.yy,w[1],i,s);if(typeof S!="undefined")return S;N&&(r=r.slice(0,-1*N*2),i=i.slice(0,-1*N),s=s.slice(0,-1*N)),r.push(this.productions_[w[1]][0]),i.push(x.$),s.push(x._$),C=o[r[r.length-2]][r[r.length-1]],r.push(C);break;case 3:return!0}}return!0}},t=function(){var e={EOF:1,parseError:function(t,n){if(!this.yy.parser)throw new Error(t);this.yy.parser.parseError(t,n)},setInput:function(t){return this._input=t,this._more=this._less=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},input:function(){var t=this._input[0];this.yytext+=t,this.yyleng++,this.offset++,this.match+=t,this.matched+=t;var n=t.match(/(?:\r\n?|\n).*/g);return n?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),t},unput:function(t){var n=t.length,r=t.split(/(?:\r\n?|\n)/g);this._input=t+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-n-1),this.offset-=n;var i=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),r.length-1&&(this.yylineno-=r.length-1);var s=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:r?(r.length===i.length?this.yylloc.first_column:0)+i[i.length-r.length].length-r[0].length:this.yylloc.first_column-n},this.options.ranges&&(this.yylloc.range=[s[0],s[0]+this.yyleng-n]),this},more:function(){return this._more=!0,this},less:function(t){this.unput(this.match.slice(t))},pastInput:function(){var t=this.matched.substr(0,this.matched.length-this.match.length);return(t.length>20?"...":"")+t.substr(-20).replace(/\n/g,"")},upcomingInput:function(){var t=this.match;return t.length<20&&(t+=this._input.substr(0,20-t.length)),(t.substr(0,20)+(t.length>20?"...":"")).replace(/\n/g,"")},showPosition:function(){var t=this.pastInput(),n=(new Array(t.length+1)).join("-");return t+this.upcomingInput()+"\n"+n+"^"},next:function(){if(this.done)return this.EOF;this._input||(this.done=!0);var t,n,r,i,s,o;this._more||(this.yytext="",this.match="");var u=this._currentRules();for(var a=0;a<u.length;a++){r=this._input.match(this.rules[u[a]]);if(r&&(!n||r[0].length>n[0].length)){n=r,i=a;if(!this.options.flex)break}}if(n){o=n[0].match(/(?:\r\n?|\n).*/g),o&&(this.yylineno+=o.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:o?o[o.length-1].length-o[o.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+n[0].length},this.yytext+=n[0],this.match+=n[0],this.matches=n,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._input=this._input.slice(n[0].length),this.matched+=n[0],t=this.performAction.call(this,this.yy,this,u[i],this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1);if(t)return t;return}return this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+". Unrecognized text.\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},lex:function(){var t=this.next();return typeof t!="undefined"?t:this.lex()},begin:function(t){this.conditionStack.push(t)},popState:function(){return this.conditionStack.pop()},_currentRules:function(){return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules},topState:function(){return this.conditionStack[this.conditionStack.length-2]},pushState:function(t){this.begin(t)}};return e.options={},e.performAction=function(t,n,r,i){function s(e,t){return n.yytext=n.yytext.substr(e,n.yyleng-t)}var o=i;switch(r){case 0:n.yytext.slice(-2)==="\\\\"?(s(0,1),this.begin("mu")):n.yytext.slice(-1)==="\\"?(s(0,1),this.begin("emu")):this.begin("mu");if(n.yytext)return 14;break;case 1:return 14;case 2:return this.popState(),14;case 3:return n.yytext=n.yytext.substr(5,n.yyleng-9),this.popState(),16;case 4:return 14;case 5:return this.popState(),13;case 6:return 59;case 7:return 62;case 8:return 17;case 9:return this.popState(),this.begin("raw"),21;case 10:return 53;case 11:return 27;case 12:return 45;case 13:return this.popState(),42;case 14:return this.popState(),42;case 15:return 32;case 16:return 37;case 17:return 49;case 18:return 46;case 19:this.unput(n.yytext),this.popState(),this.begin("com");break;case 20:return this.popState(),13;case 21:return 46;case 22:return 67;case 23:return 66;case 24:return 66;case 25:return 81;case 26:break;case 27:return this.popState(),52;case 28:return this.popState(),31;case 29:return n.yytext=s(1,2).replace(/\\"/g,'"'),74;case 30:return n.yytext=s(1,2).replace(/\\'/g,"'"),74;case 31:return 79;case 32:return 76;case 33:return 76;case 34:return 77;case 35:return 78;case 36:return 75;case 37:return 69;case 38:return 71;case 39:return 66;case 40:return 66;case 41:return"INVALID";case 42:return 5}},e.rules=[/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/,/^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/,/^(?:[^\x00]*?(?=(\{\{\{\{\/)))/,/^(?:[\s\S]*?--(~)?\}\})/,/^(?:\()/,/^(?:\))/,/^(?:\{\{\{\{)/,/^(?:\}\}\}\})/,/^(?:\{\{(~)?>)/,/^(?:\{\{(~)?#)/,/^(?:\{\{(~)?\/)/,/^(?:\{\{(~)?\^\s*(~)?\}\})/,/^(?:\{\{(~)?\s*else\s*(~)?\}\})/,/^(?:\{\{(~)?\^)/,/^(?:\{\{(~)?\s*else\b)/,/^(?:\{\{(~)?\{)/,/^(?:\{\{(~)?&)/,/^(?:\{\{(~)?!--)/,/^(?:\{\{(~)?![\s\S]*?\}\})/,/^(?:\{\{(~)?)/,/^(?:=)/,/^(?:\.\.)/,/^(?:\.(?=([=~}\s\/.)|])))/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}(~)?\}\})/,/^(?:(~)?\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=([~}\s)])))/,/^(?:false(?=([~}\s)])))/,/^(?:undefined(?=([~}\s)])))/,/^(?:null(?=([~}\s)])))/,/^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/,/^(?:as\s+\|)/,/^(?:\|)/,/^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/],e.conditions={mu:{rules:[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42],inclusive:!1},emu:{rules:[2],inclusive:!1},com:{rules:[5],inclusive:!1},raw:{rules:[3,4],inclusive:!1},INITIAL:{rules:[0,1,42],inclusive:!0}},e}();return e.lexer=t,n.prototype=e,e.Parser=n,new n}();t["default"]=r,e.exports=t["default"]},function(e,t,n){"use strict";function o(){}function u(e,t,n){t===undefined&&(t=e.length);var r=e[t-1],i=e[t-2];if(!r)return n;if(r.type==="ContentStatement")return(i||!n?/\r?\n\s*?$/:/(^|\r?\n)\s*?$/).test(r.original)}function a(e,t,n){t===undefined&&(t=-1);var r=e[t+1],i=e[t+2];if(!r)return n;if(r.type==="ContentStatement")return(i||!n?/^\s*?\r?\n/:/^\s*?(\r?\n|$)/).test(r.original)}function f(e,t,n){var r=e[t==null?0:t+1];if(!r||r.type!=="ContentStatement"||!n&&r.rightStripped)return;var i=r.value;r.value=r.value.replace(n?/^\s+/:/^[ \t]*\r?\n?/,""),r.rightStripped=r.value!==i}function l(e,t,n){var r=e[t==null?e.length-1:t-1];if(!r||r.type!=="ContentStatement"||!n&&r.leftStripped)return;var i=r.value;return r.value=r.value.replace(n?/\s+$/:/[ \t]+$/,""),r.leftStripped=r.value!==i,r.leftStripped}var r=n(8)["default"];t.__esModule=!0;var i=n(6),s=r(i);o.prototype=new s["default"],o.prototype.Program=function(e){var t=!this.isRootSeen;this.isRootSeen=!0;var n=e.body;for(var r=0,i=n.length;r<i;r++){var s=n[r],o=this.accept(s);if(!o)continue;var c=u(n,r,t),h=a(n,r,t),p=o.openStandalone&&c,d=o.closeStandalone&&h,v=o.inlineStandalone&&c&&h;o.close&&f(n,r,!0),o.open&&l(n,r,!0),v&&(f(n,r),l(n,r)&&s.type==="PartialStatement"&&(s.indent=/([ \t]+$)/.exec(n[r-1].original)[1])),p&&(f((s.program||s.inverse).body),l(n,r)),d&&(f(n,r),l((s.inverse||s.program).body))}return e},o.prototype.BlockStatement=function(e){this.accept(e.program),this.accept(e.inverse);var t=e.program||e.inverse,n=e.program&&e.inverse,r=n,i=n;if(n&&n.chained){r=n.body[0].program;while(i.chained)i=i.body[i.body.length-1].program}var s={open:e.openStrip.open,close:e.closeStrip.close,openStandalone:a(t.body),closeStandalone:u((r||t).body)};e.openStrip.close&&f(t.body,null,!0);if(n){var o=e.inverseStrip;o.open&&l(t.body,null,!0),o.close&&f(r.body,null,!0),e.closeStrip.open&&l(i.body,null,!0),u(t.body)&&a(r.body)&&(l(t.body),f(r.body))}else e.closeStrip.open&&l(t.body,null,!0);return s},o.prototype.MustacheStatement=function(e){return e.strip},o.prototype.PartialStatement=o.prototype.CommentStatement=function(e){var t=e.strip||{};return{inlineStandalone:!0,open:t.open,close:t.close}},t["default"]=o,e.exports=t["default"]},function(e,t,n){"use strict";function o(e,t){this.source=e,this.start={line:t.first_line,column:t.first_column},this.end={line:t.last_line,column:t.last_column}}function u(e){return/^\[.*\]$/.test(e)?e.substr(1,e.length-2):e}function a(e,t){return{open:e.charAt(2)==="~",close:t.charAt(t.length-3)==="~"}}function f(e){return e.replace(/^\{\{~?\!-?-?/,"").replace(/-?-?~?\}\}$/,"")}function l(e,t,n){n=this.locInfo(n);var r=e?"@":"",i=[],o=0,u="";for(var a=0,f=t.length;a<f;a++){var l=t[a].part,c=t[a].original!==l;r+=(t[a].separator||"")+l;if(!!c||l!==".."&&l!=="."&&l!=="this")i.push(l);else{if(i.length>0)throw new s["default"]("Invalid path: "+r,{loc:n});l===".."&&(o++,u+="../")}}return new this.PathExpression(e,o,i,r,n)}function c(e,t,n,r,i,s){var o=r.charAt(3)||r.charAt(2),u=o!=="{"&&o!=="&";return new this.MustacheStatement(e,t,n,u,i,this.locInfo(s))}function h(e,t,n,r){if(e.path.original!==n){var i={loc:e.path.loc};throw new s["default"](e.path.original+" doesn't match "+n,i)}r=this.locInfo(r);var o=new this.Program([t],null,{},r);return new this.BlockStatement(e.path,e.params,e.hash,o,undefined,{},{},{},r)}function p(e,t,n,r,i,o){if(r&&r.path&&e.path.original!==r.path.original){var u={loc:e.path.loc};throw new s["default"](e.path.original+" doesn't match "+r.path.original,u)}t.blockParams=e.blockParams;var a=undefined,f=undefined;return n&&(n.chain&&(n.program.body[0].closeStrip=r.strip),f=n.strip,a=n.program),i&&(i=a,a=t,t=i),new this.BlockStatement(e.path,e.params,e.hash,t,a,e.strip,f,r&&r.strip,this.locInfo(o))}var r=n(8)["default"];t.__esModule=!0,t.SourceLocation=o,t.id=u,t.stripFlags=a,t.stripComment=f,t.preparePath=l,t.prepareMustache=c,t.prepareRawBlock=h,t.prepareBlock=p;var i=n(11),s=r(i)},function(e,t,n){"use strict";function u(e,t,n){if(r.isArray(e)){var i=[];for(var s=0,o=e.length;s<o;s++)i.push(t.wrap(e[s],n));return i}return typeof e=="boolean"||typeof e=="number"?e+"":e}function a(e){this.srcFile=e,this.source=[]}t.__esModule=!0;var r=n(12),i=undefined;try{}catch(o){}i||(i=function(e,t,n,r){this.src="",r&&this.add(r)},i.prototype={add:function(t){r.isArray(t)&&(t=t.join("")),this.src+=t},prepend:function(t){r.isArray(t)&&(t=t.join("")),this.src=t+this.src},toStringWithSourceMap:function(){return{code:this.toString()}},toString:function f(){return this.src}}),a.prototype={prepend:function(t,n){this.source.unshift(this.wrap(t,n))},push:function(t,n){this.source.push(this.wrap(t,n))},merge:function(){var t=this.empty();return this.each(function(e){t.add(["  ",e,"\n"])}),t},each:function(t){for(var n=0,r=this.source.length;n<r;n++)t(this.source[n])},empty:function(){var t=arguments[0]===undefined?this.currentLocation||{start:{}}:arguments[0];return new i(t.start.line,t.start.column,this.srcFile)},wrap:function(t){var n=arguments[1]===undefined?this.currentLocation||{start:{}}:arguments[1];return t instanceof i?t:(t=u(t,this,n),new i(n.start.line,n.start.column,this.srcFile,t))},functionCall:function(t,n,r){return r=this.generateList(r),this.wrap([t,n?"."+n+"(":"(",r,")"])},quotedString:function(t){return'"'+(t+"").replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029")+'"'},objectLiteral:function(t){var n=[];for(var r in t)if(t.hasOwnProperty(r)){var i=u(t[r],this);i!=="undefined"&&n.push([this.quotedString(r),":",i])}var s=this.generateList(n);return s.prepend("{"),s.add("}"),s},generateList:function(t,n){var r=this.empty(n);for(var i=0,s=t.length;i<s;i++)i&&r.add(","),r.add(u(t[i],this,n));return r},generateArray:function(t,n){var r=this.generateList(t,n);return r.prepend("["),r.add("]"),r}},t["default"]=a,e.exports=t["default"]}])}),define("templates/index",["handlebars"],function(e){return e.template({compiler:[6,">= 2.0.0-beta.1"],main:function(e,t,n,r){return'<div class="jumbotron">\n  <div class="background">\n    <h2>ECG</h2>\n\n    <canvas class="ecg-live" height="100"></canvas>\n\n    <h2>Heart Rate</h2>\n\n    <canvas class="heart-rate-live" height="100"></canvas>\n\n    <h2>Respiratory Data</h2>\n\n    <canvas class="respiratory-live" height="100"></canvas>\n  </div>\n\n  <div class="overlay">\n    <h1>UberVest</h1>\n\n    <p>\n      View Vital Signs.\n    </p>\n\n    <p>\n      Live.\n    </p>\n\n    <p>\n      Anywhere.\n    </p>\n  </div>\n</div>\n'},useData:!0})}),define("helpers/liveChart",["jquery","smoothie"],function(e,t){return e.fn.liveChart=function(e){var t,n,r,i;return t=this,t.attr("width")||(r=parseInt(t.css("margin-left").replace("px","")),i=parseInt(t.css("margin-right").replace("px","")),t.attr("width",t.parent().innerWidth()-r-i)),n=new SmoothieChart({labels:{disabled:!0}}),n.addTimeSeries(e,{strokeStyle:"rgba(0, 255, 0, 1)",lineWidth:2}),n.streamTo(t[0],500),n}});var bind=function(e,t){return function(){return e.apply(t,arguments)}},extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("views/index",["jquery","underscore","marionette","backbone.radio","smoothie","templates/index","helpers/liveChart"],function(e,t,n,r,i,s,o){var u;return u=function(n){function i(){return this.onDestroy=bind(this.onDestroy,this),this.generateDemoSeries=bind(this.generateDemoSeries,this),this.onAttach=bind(this.onAttach,this),i.__super__.constructor.apply(this,arguments)}return extend(i,n),i.prototype.template=s,i.prototype.initialize=function(){return this.generateInterval=setInterval(function(e){return function(){return e.generateDemoSeries()}}(this),4),e.getJSON(r.channel("application").request("websiteBaseUrl")+"/sample_data/ecg.json",function(e){return function(t){return e.sampleData.ecg=t.data}}(this))},i.prototype.sampleData={},i.prototype.demoSeries={ecg:new TimeSeries,heartRate:new TimeSeries,respiratory:new TimeSeries},i.prototype.liveCharts={ecg:null,heartRate:null,respiratory:null},i.prototype.onAttach=function(){return this.liveCharts.ecg=this.$(".ecg-live").liveChart(this.demoSeries.ecg),this.liveCharts.heartRate=this.$(".heart-rate-live").liveChart(this.demoSeries.heartRate),this.liveCharts.respiratory=this.$(".respiratory-live").liveChart(this.demoSeries.respiratory)},i.prototype.generateDemoSeries=function(){var e,t,n,r,i;if(this.sampleData.ecg){e=new Date,i=e.getTime(),r=i%1e4,n=Math.round(r/4),t=this.sampleData.ecg[n];if(t)return i=e.getTime(),this.demoSeries.ecg.append(i,t)}},i.prototype.onDestroy=function(){return clearInterval(this.generateInterval),t(this.liveCharts).each(function(e){return e.stop()})},i}(n.ItemView)});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("models/device",["backbone"],function(e){var t;return t=function(e){function t(){return t.__super__.constructor.apply(this,arguments)}return extend(t,e),t.prototype.url=function(){return typeof id!="undefined"&&id!==null?Radio.channel("application").request("apiUrl")+("/devices/"+id+".json"):Radio.channel("application").request("apiUrl")+"/devices.json"},t}(e.Model)});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("collections/device_collection",["backbone","backbone.radio","models/device"],function(e,t,n){var r;return r=function(e){function r(){return r.__super__.constructor.apply(this,arguments)}return extend(r,e),r.prototype.model=n,r.prototype.url=function(){return t.channel("application").request("apiUrl")+"/devices.json"},r}(e.Collection)}),define("templates/dashboard/device",["handlebars"],function(e){return e.template({compiler:[6,">= 2.0.0-beta.1"],main:function(e,t,n,r){var i,s=t.helperMissing,o="function",u=this.escapeExpression;return"<h3>"+u((i=(i=t.owner||(e!=null?e.owner:e))!=null?i:s,typeof i===o?i.call(e,{name:"owner",hash:{},data:r}):i))+"</h3>\n\n<p>\n  Device ID: "+u((i=(i=t.id||(e!=null?e.id:e))!=null?i:s,typeof i===o?i.call(e,{name:"id",hash:{},data:r}):i))+'\n</p>\n\n<div class="row">\n  <div class="col-md-4">\n    <h4>ECG Trace</h4>\n\n    <canvas class="ecg-live" height="100"></canvas>\n  </div>\n\n  <div class="col-md-2">\n    <h4>Heart Rate</h4>\n\n    <p>\n      <span data-heart-rate-live-text class="live-text">\n        0\n      </span>\n\n      <span class="unit">\n        Beats Per Minute\n      </span>\n    </p>\n  </div>\n\n  <div class="col-md-4">\n    <h4>Respiratory Trace</h4>\n\n    <canvas class="respiratory-live" height="100"></canvas>\n  </div>\n\n  <div class="col-md-2">\n    <h4>Respiratory Rate</h4>\n\n    <p>\n      <span data-respiratory-rate-live-text class="live-text">\n        0\n      </span>\n\n      <span class="unit">\n        Breaths Per Minute\n      </span>\n    </p>\n  </div>\n</div>\n'},useData:!0})});var bind=function(e,t){return function(){return e.apply(t,arguments)}},extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("views/dashboard/device",["marionette","templates/dashboard/device"],function(e,t){var n;return n=function(e){function n(){return this.onDestroy=bind(this.onDestroy,this),this.onAttach=bind(this.onAttach,this),n.__super__.constructor.apply(this,arguments)}return extend(n,e),n.prototype.tagName="li",n.prototype.className="device",n.prototype.template=t,n.prototype.dataSeries={ecg:new TimeSeries,respiratory:new TimeSeries},n.prototype.liveCharts={ecg:null,respiratory:null},n.prototype.onAttach=function(){return this.liveCharts.ecg=this.$(".ecg-live").liveChart(this.dataSeries.ecg),this.liveCharts.respiratory=this.$(".respiratory-live").liveChart(this.dataSeries.respiratory)},n.prototype.onDestroy=function(){return _(this.liveCharts).each(function(e){return e.stop()})},n}(e.ItemView)}),define("templates/dashboard",["handlebars"],function(e){return e.template({compiler:[6,">= 2.0.0-beta.1"],main:function(e,t,n,r){return'<div class="container">\n  <div class="row">\n    <div class="col-md-12">\n      <h1>Dashboard</h1>\n    </div>\n  </div>\n\n  <div class="row">\n    <div class="col-md-12">\n      <ul class="devices">\n      </ul>\n    </div>\n  </div>\n</div>\n'},useData:!0})});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("views/dashboard",["marionette","collections/device_collection","views/dashboard/device","templates/dashboard"],function(e,t,n,r){var i;return i=function(e){function i(){return i.__super__.constructor.apply(this,arguments)}return extend(i,e),i.prototype.template=r,i.prototype.className="dashboard",i.prototype.collection=new t,i.prototype.childView=n,i.prototype.childViewContainer=".devices",i.prototype.initialize=function(){return this.collection.fetch()},i}(e.CompositeView)}),define("templates/about",["handlebars"],function(e){return e.template({compiler:[6,">= 2.0.0-beta.1"],main:function(e,t,n,r){return'<div class="container">\n  <h1>About</h1>\n\n  <p>\n    Team Members:\n  </p>\n\n  <ul>\n    <li>Hayden Ball</li>\n    <li>Filip Frahm</li>\n    <li>Roy Hotrabhavnon</li>\n    <li>Milan Pavlik</li>\n    <li>Jonathan Redmond</li>\n  </ul>\n</div>\n'},useData:!0})});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("views/about",["marionette","templates/about"],function(e,t){var n;return n=function(e){function n(){return n.__super__.constructor.apply(this,arguments)}return extend(n,e),n.prototype.template=t,n}(e.ItemView)}),define("templates/login",["handlebars"],function(e){return e.template({compiler:[6,">= 2.0.0-beta.1"],main:function(e,t,n,r){return'<div class="col-sm-6 col-sm-offset-3 col-md-4 col-md-offset-4">\n  <form class="form-login">\n\n    <h2>Welcome Back</h2>\n    <h3>Please log in</h2>\n\n    <label for="email" class="sr-only">Email address</label>\n    <input type="email" id="email" name="email" class="form-control" placeholder="Email address" required autofocus>\n\n    <label for="password" class="sr-only">Password</label>\n    <input type="password" id="password" name="password" class="form-control" placeholder="Password" required>\n\n    <button class="btn btn-lg btn-primary btn-block" type="submit">Sign in</button>\n\n  </form>\n</div>\n'},useData:!0})});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("views/login",["marionette","backbone.radio","templates/login"],function(e,t,n){var r;return r=function(e){function r(){return r.__super__.constructor.apply(this,arguments)}return extend(r,e),r.prototype.template=n,r.prototype.events={"submit form":"login"},r.prototype.login=function(e){var n,r;return e.preventDefault(),n=this.$("form").serialize(),alert("Logging in with "+n),r=function(e){return t.channel("authentication").trigger("login",e),t.channel("navigation").trigger("navigate","/",{trigger:!0})},r({authToken:"123456789",firstname:"Test",lastname:"Tester"}),!1},r}(e.ItemView)});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("router",["backbone","backbone.radio","views/index","views/dashboard","views/about","views/login"],function(e,t,n,r,i,s){var o;return o=function(e){function o(){return o.__super__.constructor.apply(this,arguments)}return extend(o,e),o.prototype.routes={"":"index",about:"about",login:"login"},o.prototype.initialize=function(e){return this.app=e.app,this.listenTo(t.channel("navigation"),"navigate",function(e){return function(t,n){return e.navigate(t,n)}}(this))},o.prototype.index=function(){return t.channel("authentication").request("currentUser")?this.app.rootView.main.show(new r):this.app.rootView.main.show(new n)},o.prototype.about=function(){return this.app.rootView.main.show(new i)},o.prototype.login=function(){return this.app.rootView.main.show(new s)},o}(e.Router)});var bind=function(e,t){return function(){return e.apply(t,arguments)}},extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("models/user_session",["backbone","backbone.radio"],function(e,t){var n;return n=function(e){function n(){return this.getCurrentUser=bind(this.getCurrentUser,this),this.setCurrentUser=bind(this.setCurrentUser,this),n.__super__.constructor.apply(this,arguments)}return extend(n,e),n.prototype.currentUser=null,n.prototype.initialize=function(){return this.bindListeners(),this.bindResponders()},n.prototype.bindListeners=function(){return this.listenTo(t.channel("authentication"),"login",function(e){return function(t){return e.setCurrentUser(t)}}(this)),this.listenTo(t.channel("authentication"),"logout",function(e){return function(){return e.setCurrentUser(null)}}(this))},n.prototype.bindResponders=function(){return t.channel("authentication").reply("currentUser",function(e){return function(){return e.getCurrentUser()}}(this))},n.prototype.setCurrentUser=function(e){return this.currentUser=e,e?(localStorage.setItem("authToken",e.authToken),localStorage.setItem("firstname",e.firstname),localStorage.setItem("lastname",e.lastname)):(localStorage.removeItem("authToken"),localStorage.removeItem("firstname"),localStorage.removeItem("lastname"))},n.prototype.getCurrentUser=function(){var e;if(this.currentUser!=null)return this.currentUser;e=localStorage.getItem("authToken");if(!e)return;return this.currentUser={authToken:e,firstname:localStorage.getItem("firstname"),lastname:localStorage.getItem("lastname")}},n}(e.Model)}),define("templates/navbar",["handlebars"],function(e){return e.template({1:function(e,t,n,r){var i,s=t.helperMissing,o="function",u=this.escapeExpression;return"        <li><a data-logout>"+u((i=(i=t.firstname||(e!=null?e.firstname:e))!=null?i:s,typeof i===o?i.call(e,{name:"firstname",hash:{},data:r}):i))+" "+u((i=(i=t.lastname||(e!=null?e.lastname:e))!=null?i:s,typeof i===o?i.call(e,{name:"lastname",hash:{},data:r}):i))+": Logout</a></li>\n"},3:function(e,t,n,r){return'        <li><a href="#/login">Login</a></li>\n'},compiler:[6,">= 2.0.0-beta.1"],main:function(e,t,n,r){var i;return'<div class="container">\n  <div class="navbar-header">\n    <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">\n      <span class="sr-only">Toggle navigation</span>\n      <span class="icon-bar"></span>\n      <span class="icon-bar"></span>\n      <span class="icon-bar"></span>\n    </button>\n    <a class="navbar-brand" href="#/">SLIP Group A</a>\n  </div>\n  <div id="navbar" class="collapse navbar-collapse">\n    <ul class="nav navbar-nav">\n'+((i=t["if"].call(e,e!=null?e.loggedIn:e,{name:"if",hash:{},fn:this.program(1,r,0),inverse:this.program(3,r,0),data:r}))!=null?i:"")+'    </ul>\n\n    <ul class="nav navbar-nav pull-right">\n      <li><a href="#/about">About</a></li>\n    </ul>\n  </div><!--/.nav-collapse -->\n</div>\n'},useData:!0})});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("views/navbar",["marionette","backbone.radio","templates/navbar"],function(e,t,n){var r;return r=function(e){function r(){return r.__super__.constructor.apply(this,arguments)}return extend(r,e),r.prototype.template=n,r.prototype.user=null,r.prototype.events={"click [data-logout]":"logout"},r.prototype.serializeData=function(){var e;return e=this.user||{},e.loggedIn=this.user!=null,e},r.prototype.initialize=function(){return this.user=t.channel("authentication").request("currentUser"),this.listenTo(t.channel("authentication"),"login",function(e){return function(t){return e.user=t,e.render()}}(this)),this.listenTo(t.channel("authentication"),"logout",function(e){return function(t){return e.user=null,e.render()}}(this))},r.prototype.logout=function(){return t.channel("authentication").trigger("logout")},r}(e.ItemView)});var extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("views/main",["marionette","views/navbar"],function(e,t){var n;return n=function(e){function n(){return n.__super__.constructor.apply(this,arguments)}return extend(n,e),n.prototype.regions={main:"#backbone-content",navbar:"nav.navbar"},n.prototype.initialize=function(){return this.navbar.show(new t)},n}(e.LayoutView)});var bind=function(e,t){return function(){return e.apply(t,arguments)}},extend=function(e,t){function r(){this.constructor=e}for(var n in t)hasProp.call(t,n)&&(e[n]=t[n]);return r.prototype=t.prototype,e.prototype=new r,e.__super__=t.prototype,e},hasProp={}.hasOwnProperty;define("application",["marionette","backbone.radio","router","models/user_session","views/main"],function(e,t,n,r,i){var s;return s=function(e){function s(){return this.bindRadioResponses=bind(this.bindRadioResponses,this),s.__super__.constructor.apply(this,arguments)}return extend(s,e),s.prototype.apiUrl=function(){return window.location.toString().match(/localhost/)?"http://localhost:8000":"http://api-ubervest.rhcloud.com"},s.prototype.websiteBaseUrl=function(){return window.location.toString().match(/localhost/)?"http://localhost:9000":window.location.toString().match(/github.io/)?"http://easycz.github.io/SLIP-A-2015":"http://groups.inf.ed.ac.uk/teaching/slipa15-16"},s.prototype.initialize=function(){return this.bindRadioResponses(),this.session=new r,this.rootView=new i({el:"body"}),this.router=new n({app:this}),Backbone.history.start()},s.prototype.bindRadioResponses=function(){return t.channel("application").reply("apiUrl",function(e){return function(){return e.apiUrl()}}(this)),t.channel("application").reply("websiteBaseUrl",function(e){return function(){return e.websiteBaseUrl()}}(this))},s}(e.Application)}),require.config({baseUrl:"/js",paths:{marionette:"backbone.marionette"}}),require(["application"],function(e){return window.application=new e}),define("main",function(){})})();