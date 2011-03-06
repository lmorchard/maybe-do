/** 
 * main JS enhanvements 
 */

var MaybeDoItem = Backbone.Model.extend({
    
    defaults: {
        body: '',
        human_index: null,
        created: null,
        updated: null
    },
    
    initialize: function (attributes, options) {
        this.attributes.created = new Date();
        this.attributes.updated = new Date();
        Backbone.Model.prototype.initialize.call(this, attributes, options);
    }

});

var MaybeDoItemCollection = Backbone.Collection.extend({

    model: MaybeDoItem,
    
    comparator: function (item) {
        if (null !== item.get('human_index')) {
            return item.get('human_index');
        } else {
            return 0 - item.get('updated').getTime();
        }
    }

});

var MaybeUI = ( function () {

    var $this = {

        blobastorus_user: null,
        blobastorus_save_delay: 3000,
        blobastorus_scope: 'maybedo',

        /** Initialize the view */
        init: function () {

            // Look for item data in the query string, decompress and
            // initialize localStorage from it if present.
            var qs_items = $this.getParameterByName('items');
            if (qs_items) {
                var lz = new LZ77();
                window.localStorage.items = lz.decompress(atob(qs_items));
            }

            // Initialize localStorage if none yet present
            if (window.localStorage && !window.localStorage.items) {
                window.localStorage.items = "[]";
            }

            // Load any items available from localStorage, fire up the UI.
            $this.loadItems();
            $(document).ready($this.onReady);

            return $this;
        },

        /** Start with a clean items collection */
        clearItems: function () {
            $this.items = new MaybeDoItemCollection();
            var refresh = function () {
                $this.refreshItems();
                $this.snapshotItems();
            };
            $this.items.bind('add', refresh);
            $this.items.bind('remove', refresh);
            $this.items.bind('change', refresh);
        },

        /** Load items from localstorage */
        loadItems: function (items_data) {
            try {

                var items_data = items_data || JSON.parse(window.localStorage.items);
                if (!items_data) { return; }

                $this.clearItems();

                _(items_data).each(function (data) {
                    $this.items.add(
                        new MaybeDoItem(data), 
                        { silent: true }
                    );
                });

            } catch (e) {
                // No-op, assume bad localstorage data.
            }
            return this;
        },

        /** Save a snapshot of items to localstorage */
        snapshotItems: function () {
            // TODO: This gets called a lot. Maybe need to stick it behind a delay / debounce timer?
            var items_data = $this.items.map(function (item) {
                return item.toJSON();
            });
            window.localStorage.items = JSON.stringify(items_data);
            $this.saveToBlobastorus(items_data);
        },

        /** Search up through parents for a containing link element */
        findLinkParent: function (tar_el) {
            while (tar_el && 'A' != tar_el.tagName) {
                tar_el = tar_el.parentNode;
            }
            return $(tar_el);
        },

        /** Wire up and initialize the UI on page ready */
        onReady: function () {
            $this.wireUpHomePageUI();
            $this.wireUpComparePageUI();
            $this.wireUpPageChanges();
            $this.refreshItems();
            $this.checkBlobastorusData();
        },

        /** Wire up UI elements for home page */
        wireUpHomePageUI: function () {
            $('#add-item').live('click', $this.addItem);
            $('#save-item').live('click', $this.saveItem);

            $('#body').live('keypress', function (ev) {
                if (13 == ev.keyCode) { 
                    return $('#body-field').hasClass('edit-mode') ? 
                        $this.saveItem(ev) : $this.addItem(ev); 
                }
            });
            
            $('#edit-list').live('click', function (ev) {
                $('#maybe-items').toggleClass('show-controls');
                return false;
            });

            $('#maybe-items').bind('click', function (ev) {
                var target = $this.findLinkParent(ev.target);
                if (target.hasClass('select')) {
                    $this.editItem(target.parents('li.item'));
                } else if (target.hasClass('options')) {
                    $this.optionsItem(target.parents('li.item'));
                }
                return false;
            });
        },

        /** Wire up UI elements for compare page */
        wireUpComparePageUI: function () {
            $('#compare-items').bind('click', function (ev) {
                var target = $this.findLinkParent(ev.target);
                if (target.hasClass('select')) {
                    $this.compareItemSelect(target.parents('li.item'));
                }
                return false;
            });
        },

        /** Wire up events to react to page changes */
        wireUpPageChanges: function () {
            $('#maybe-home').live('pageshow', function (ev, ui) {
                $this.refreshItems();
            });
            $('#maybe-compare').live('pageshow', function (ev, ui) {
                $this.initCompare();
            });
            $('#maybe-settings').live('pageshow', function (ev, ui) {
                $this.initSettings();
            });
        },

        /** Handle adding a new item */
        addItem: function (ev) {
            var body = $('#body').val();
            if (body) {
                $this.items.add(new MaybeDoItem({
                    body: body
                }));
                $('#body').val('').focus();
            }
            return false;
        },

        /** Handle selecting an item for edit */
        editItem: function (item_el) {
            var item = $this.items.getByCid(item_el.attr('data-cid'));
            $('#save-item').data('edited_item', item);
            $('#body-field').addClass('edit-mode');
            $('#body').val(item.get('body')).focus();
        },

        /** Save an item benig edited */
        saveItem: function (ev) {
            var save_button = $('#save-item');

            var item = save_button.data('edited_item');
            if (!item) { return false; }
            
            var new_val = $('#body').val();
            $('#body').val('');

            item.set({ body: new_val });
            $('#item-' + item.cid + ' a.body').text(new_val).focus();

            $('#body-field').removeClass('edit-mode');

            return false;
        },

        /*
        optionsItem: function (item_el) {
            item_el.toggleClass('show-controls');
        },
        */

        /**
         * Refresh the displayed list of items.
         *
         * TODO: This wipes and rebuilds the list, which should be fine for
         * a human-scale number of items. Maybe change this.
         */
        refreshItems: function () {
            var par = $('#maybe-items');
            par.find('>li').remove();

            $this.items.sort().each(function (item) {
                par.append(ich.maybe_item(_({}).extend(
                    { cid: item.cid }, 
                    item.toJSON()
                )));
            });

            if (par.data('listview')) {
                par.listview('refresh');
            }
        },

        /** Initialize for pairwise comparison and sort */
        initCompare: function () {
            $this.sort_cids = $this.items.map(function (item) { return item.cid; });
            $this.sort_idx = 0;

            $this.updateCompare();
        },

        /** Initialize the settings page */
        initSettings: function () {
            $this.snapshotItems();

            var lz = new LZ77();
            var data = btoa(lz.compress(window.localStorage.items));
            $('#settings-link').attr('href', 'index.html?items=' + data);

            /*
            var par = $('#settings-links');
            par.find('>a').remove();
            par.append(ich.settings_link({ 
                href: 'index.html?items='+data
            }));
            */
        },

        /** Update the display based on the current sort index */
        updateCompare: function () {
            if ($this.sort_idx >= $this.sort_cids.length) { return; }

            var item_a = $this.items.getByCid($this.sort_cids[$this.sort_idx]);
            var item_b = $this.items.getByCid($this.sort_cids[$this.sort_idx+1]);

            var par = $('#compare-items');
            par.find('>li').remove();

            _([ item_a, item_b ]).each(function (item, idx) {
                par.append(ich.sort_item(_({}).extend(
                    { idx: idx, cid: item.cid },
                    item.toJSON()
                )));
            });

            if (par.data('listview')) {
                par.listview('refresh');
            }
        },

        /** Handle a tap on one of the two items offered for comparison */
        compareItemSelect: function (item_el) {
            var item = $this.items.getByCid(item_el.attr('data-cid'));
            
            // Only when the second of the two is tapped is any swapping done.
            if (item_el.attr('data-idx') == 1) {

                // Swap the current two items.
                var idx = $this.sort_idx;
                var tmp = $this.sort_cids[idx];
                $this.sort_cids[idx] = $this.sort_cids[idx+1];
                $this.sort_cids[idx+1] = tmp;

                // Update the human index for all items.
                _($this.sort_cids).each(function (cid, idx) {
                    $this.items.getByCid(cid).set({ human_index: idx });
                });

            }

            // Advance the sort pointer, wrap around if we reach then end.
            $this.sort_idx++;
            if ($this.sort_idx >= ($this.sort_cids.length - 1)) {
                $this.sort_idx = 0;
            }

            $this.updateCompare();
        },

        /** Get a query string parameter by name */
        getParameterByName: function (name) {
            // see: http://stackoverflow.com/questions/901115/get-querystring-values-with-jquery/901144#901144
            name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
            var regexS = "[\\?&]"+name+"=([^&#]*)";
            var regex = new RegExp( regexS );
            var results = regex.exec( window.location.href );
            if( results == null ) {
                return "";
            } else {
                return decodeURIComponent(results[1].replace(/\+/g, " "));
            }
        },

        checkBlobastorusData: function () {
            if ('undefined' == typeof Blobastorus) { return; }

            Blobastorus.setScope($this.blobastorus_scope);

            Blobastorus.getUser(function(user, error) {

                // step 3: if the user is not authenticated, show them a button they can
                // click on to authenticate via twitter
                if (error === 'needsAuth') {
                    $("#login").show();
                    $("#login").click(function() { 
                        Blobastorus.redirectUser(); 
                        return false; 
                    });
                    $this.blobastorus_user = null;
                }

                // step 4: if the user *is* authenticated, welcome them by name
                else {
                    $("#blobastorus-status").addClass('logged-in');
                    $("#howmany").show();
                    $("#user").text(user);
                    $this.blobastorus_user = user;

                    // step 5: now let's get the user's blob. how many times have they logged in?
                    Blobastorus.getBlob(function(data) {
                        if (data && data.items) {
                            $this.loadItems(data.items);
                            $this.refreshItems();
                        }
                    });
                }
            });

        },

        /** 
         * Update blobastorus data from localstorage. 
         * This will wait 3 seconds after any change before posting a new blob.
         */
        saveToBlobastorus: function (items_data) {
            var fn = arguments.callee;
            if (!$this.blobastorus_user) { return; }
            if (fn._delay) { window.clearTimeout(fn._delay); }
            fn._delay = window.setTimeout(function () {
                Blobastorus.setBlob({
                    items: items_data
                });
            }, $this.blobastorus_save_delay);
        },

        EOF:null
    };

    return $this.init();

} )();
