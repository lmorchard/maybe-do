/** main JS enhanvements */

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

    var items = [
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        "Donec varius risus vitae mauris consectetur tincidunt.",
        "In in sapien justo.",
        /*
        "Donec dictum, eros quis mattis dignissim, tortor velit auctor mauris, convallis sodales libero elit eu elit.",
        "Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.",
        "Donec eu dolor sem.",
        "In ultricies, nisl at rhoncus dignissim, mi est mattis tellus, non mattis lacus ante id nibh.",
        "Sed enim lorem, dictum in vulputate quis, accumsan ac nisl.",
        "Sed mi purus, vestibulum tincidunt condimentum ut, pretium vel ante.",
        "Etiam ut gravida urna.",
        "Duis nulla justo, ullamcorper vulputate commodo in, blandit eget arcu.",
        "Quisque mauris eros, imperdiet at dignissim nec, gravida id massa.",
        "Cras faucibus turpis vel purus adipiscing vitae fringilla justo dapibus."
        */
    ];

    var $this = {

        init: function () {
            $this.loadItems();
            $(document).ready($this.onReady);
        },

        loadItems: function () {
            $this.items = new MaybeDoItemCollection();
            _(items).each(function (body) {
                $this.items.add(
                    new MaybeDoItem({ body: body }), 
                    { silent: true }
                );
            });
            return this;
        },

        findLinkParent: function (tar_el) {
            while (tar_el && 'A' != tar_el.tagName) {
                tar_el = tar_el.parentNode;
            }
            return $(tar_el);
        },

        onReady: function () {

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

            $this.refreshItems();
            $this.items.bind('add', function () {
                $this.refreshItems();
            });
        },

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

        editItem: function (item_el) {
            var item = $this.items.getByCid(item_el.attr('data-cid'));
            $('#save-item').data('edited_item', item);
            $('#body-field').addClass('edit-mode');
            $('#body').val(item.get('body')).focus();
        },

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

        optionsItem: function (item_el) {
            item_el.toggleClass('show-controls');
        },

        /**
         * Refresh the displayed list of items.
         *
         * TODO: This wipes and rebuilds the list, which should be fine for
         * a human-scale number of items. Maybe change this.
         */
        refreshItems: function () {
            var par = $('#maybe-items');
            par.find('>li').remove();
            $this.items.each(function (item) {
                par.append(ich.maybe_item(_({}).extend(
                    { cid: item.cid }, 
                    item.toJSON()
                )));
            });
            if (par.data('listview')) {
                par.listview('refresh');
            }
        },

        EOF:null
    };

    return $this.init();

} )();
