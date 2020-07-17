/*
 * Dirty 
 * jquery plugin to detect when a form is modified
 * (c) 2016 Simon Taite - https://github.com/simontaite/jquery.dirty
 * originally based on jquery.dirrty by Ruben Torres - https://github.com/rubentd/dirrty
 * Released under the MIT license
 */

(function($) {

    //Save dirty instances
    var singleDs = [];
    var dirty = "dirty";
    var clean = "clean";
    var dataInitialValue = "dirtyInitialValue";
    var dataIsDirty = "isDirty";
    var _debug = false;

    var getSingleton = function(obj) {
        var result;
        singleDs.forEach(function(e) {
            if (e.form.is(obj)) {
                result = e;
            }
        });
        return result;
    };

    var setSubmitEvents = function(d) {
        d.form.on("submit", function() {
            d.submitting = true;
        });

        if (d.options.preventLeaving) {
            $(window).on("beforeunload", function() {
                if (d.isDirty && !d.submitting) {
                    return d.options.leavingMessage;
                }
            });
        }
    };

    var setNamespacedEventTriggers = function(d) {

        d.form.find("input, select, textarea").on("change keyup keydown", function(e) {
            $(this).trigger(e.type + ".dirty");
        });
    };

    var setNamespacedEvents = function(d) {

        d.form.find("input, select, textarea").on("change.dirty keyup.dirty keydown.dirty", function(e) {
            d.checkValues(e);
        });

        d.form.on("dirty", function() {
            if (_debug) console.log('dirty', d.form);
            d.options.onDirty();
        });

        d.form.on("clean", function() {
            if (_debug) console.log('clean', d.form);
            d.options.onClean();
        });
    };

    var clearNamespacedEvents = function(d) {
        d.form.find("input, select, textarea").off("change.dirty keyup.dirty keydown.dirty"); 

        d.form.off("dirty");

        d.form.off("clean");
    };

    var Dirty = function(form, options) {
        this.form = form;
        this.isDirty = false;
        this.options = options;
        this.history = [clean, clean]; //Keep track of last statuses
        this.id = $(form).attr("id");
        singleDs.push(this);
    };

    Dirty.prototype = {
        init: function() {
            this.saveInitialValues();
            this.setEvents();
        },

        isRadioOrCheckbox: function(el){
            return $(el).is(":radio, :checkbox");
        },

        isFileInput: function(el){
            return $(el).is(":file")
        },

        saveInitialValues: function() {
            var d = this;
            this.form.find("input, select, textarea").each(function(_, e) {

                var isRadioOrCheckbox = d.isRadioOrCheckbox(e);
                var isFile = d.isFileInput(e);

                if (isRadioOrCheckbox) {
                    var isChecked = $(e).is(":checked") ? "checked" : "unchecked";
                    $(e).data(dataInitialValue, isChecked);
                } else if(isFile){
                    $(e).data(dataInitialValue, JSON.stringify(e.files))
                } else {
                    $(e).data(dataInitialValue, $(e).val() || '');
                }
            });
        },

        refreshEvents: function () {
            var d = this;
            clearNamespacedEvents(d);
            setNamespacedEvents(d);
        },

        showDirtyFields: function() {
            var d = this;

            return d.form.find("input, select, textarea").filter(function(_, e){
                return $(e).data("isDirty");
            });
        },

        setEvents: function() {
            var d = this;

            setSubmitEvents(d);
            setNamespacedEvents(d);
            setNamespacedEventTriggers(d);
        },

        isFieldDirty: function($field) {
            var initialValue = $field.data(dataInitialValue);
            // Explicitly check for null/undefined here as value may be `false`, so ($field.data(dataInitialValue) || '') would not work
            if (initialValue == null) { initialValue = ''; }
            var currentValue = $field.val();
            if (currentValue == null) { currentValue = ''; }

            // Boolean values can be encoded as "true/false" or "True/False" depending on underlying frameworks so we need a case insensitive comparison
            var boolRegex = /^(true|false)$/i;
            var isBoolValue = boolRegex.test(initialValue) && boolRegex.test(currentValue);
            if (isBoolValue) {
                var regex = new RegExp("^" + initialValue + "$", "i");
                return !regex.test(currentValue);
            }

            return currentValue !== initialValue;
        },

        isFileInputDirty: function($field) {
            var initialValue = $field.data(dataInitialValue);

            var plainField = $field[0];
            var currentValue = JSON.stringify(plainField.files);

            return currentValue !== initialValue;
        },

        isCheckboxDirty: function($field) {
            var initialValue = $field.data(dataInitialValue);
            var currentValue = $field.is(":checked") ? "checked" : "unchecked";

            return initialValue !== currentValue;
        },

        checkValues: function(e) {
            var d = this;
            var formIsDirty = d.isDirty;

            this.form.find("input, select, textarea").each(function(_, el) {
                var isRadioOrCheckbox = d.isRadioOrCheckbox(el);
                var isFile = d.isFileInput(el);
                var $el = $(el);

                var thisIsDirty;
                if (isRadioOrCheckbox) {
                    thisIsDirty = d.isCheckboxDirty($el);
                } else if (isFile) {
                    thisIsDirty = d.isFileInputDirty($el);
                } else {
                    thisIsDirty = d.isFieldDirty($el);
                }

                $el.data(dataIsDirty, thisIsDirty);

                formIsDirty |= thisIsDirty;
            });

            if (formIsDirty) {
                d.setDirty();
            } else {
                d.setClean();
            }

            if (e) {
                e.stopImmediatePropagation();
            }
        },

        setDirty: function() {
            this.isDirty = true;
            this.history[0] = this.history[1];
            this.history[1] = dirty;

            if (this.options.fireEventsOnEachChange || this.wasJustClean()) {
                this.form.trigger("dirty");
            }
        },

        setClean: function() {
            this.isDirty = false;
            this.history[0] = this.history[1];
            this.history[1] = clean;

            if (this.options.fireEventsOnEachChange || this.wasJustDirty()) {
                this.form.trigger("clean");
            }
        },

        //Lets me know if the previous status of the form was dirty
        wasJustDirty: function() {
            return (this.history[0] === dirty);
        },

        //Lets me know if the previous status of the form was clean
        wasJustClean: function() {
            return (this.history[0] === clean);
        },

        setAsClean: function(){
            this.saveInitialValues();
            this.setClean();
        },

        setAsDirty: function(){
            this.saveInitialValues();
            this.setDirty();
        },

        resetForm: function(){
            var d = this;
            this.form.find("input, select, textarea").each(function(_, e) {

                var $e = $(e);
                var isRadioOrCheckbox = d.isRadioOrCheckbox(e);
                var isFile = d.isFileInput(e);

                if (isRadioOrCheckbox) {
                    var initialCheckedState = $e.data(dataInitialValue);
                    var isChecked = initialCheckedState === "checked";

                    $e.prop("checked", isChecked);
                } if(isFile) {
                    e.value = "";
                    $(e).data(dataInitialValue, JSON.stringify(e.files))

                } else {
                    var value = $e.data(dataInitialValue);
                    $e.val(value);
                }
            });

            this.checkValues();
        }
    };

    $.fn.dirty = function(actionOroptions, opts) {

        if (typeof actionOroptions === "string" && /^(isDirty|isClean|refreshEvents|resetForm|setAsClean|setAsDirty|showDirtyFields)$/i.test(actionOroptions)) {
            //Check if we have an instance of dirty for this form
            // TODO: check if this is DOM or jQuery object
            //var d = getSingleton($(this).attr("id"));

            var options = opts;

            var optionsLowerCase = actionOroptions.toLowerCase();

            var result = null;

            // apply to selected objects
            this.each(function (_, e) {

                // get dirty obj for this form
                var d = getSingleton($(e));

                if (!d) {
                    options = $.extend({}, $.fn.dirty.defaults, options);
                    d = new Dirty($(e), options);
                    d.init();
                    if (_debug) console.log('track form', e);
                }

                switch (optionsLowerCase) {
                    case "isclean":
                        if (result == null) { result = true; }
                        result = result && !d.isDirty;
                        break;
                    case "isdirty":
                        if (result == null) { result = false; }
                        result = result || d.isDirty;
                        break;
                    case "refreshevents":
                        d.refreshEvents();
                        break;
                    case "resetform":
                        d.resetForm();
                        break;
                    case "setasclean":
                        d.setAsClean();
                        break;
                    case "setasdirty":
                        d.setAsDirty();
                        break;
                    case "showdirtyfields":
                        if (result == null) { result = []; }
                        result.push(d.showDirtyFields());
                        break;
                }
            });

            return result;

        } else if (typeof actionOroptions === "object" || !actionOroptions) {

            var options = actionOroptions;

            return this.each(function(_, e) {
                options = $.extend({}, $.fn.dirty.defaults, options);
                var dirty = new Dirty($(e), options);
                dirty.init();
                if (_debug) console.log('track form', e);
            });

        }
    };

    $.fn.dirty.defaults = {
        preventLeaving: false,
        leavingMessage: "There are unsaved changes on this page which will be discarded if you continue.",
        onDirty: $.noop, //This function is fired when the form gets dirty
        onClean: $.noop, //This funciton is fired when the form gets clean again
        fireEventsOnEachChange: false, // Fire onDirty/onClean on each modification of the form
    };

})(jQuery);
