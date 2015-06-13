/*global $,moment,Hoodie*/
(function () {
    "use strict";
    var hoodie,
        App,
        Transactions;

    // initialize Hoodie
    hoodie = new Hoodie();

    // helper function to escape HTML
    function escapeHtml(string) {
        var entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;',
            "'": '&#39;',
            "/": '&#x2F;'
        };
        return String(string).replace(/[&<>"'\/]/g, function (s) {
            return entityMap[s];
        });
    }

    // TRANSACTIONS ---------------------------------
    // Generic class for Transactions
    Transactions = function ($element) {
        var collection = [],
            $el = $element,
            sum = 0.0;

        function getTransactionItemIndexById(id) {
            var i;
            for (i = 0; i < collection.length; i += 1) {
                if (collection[i].id === id) {
                    return i;
                }
            }
            return null;
        }

        function paint() {
            var i,
                curamountid,
                curamount,
                roundedsum;
            sum = 0.0;
            $el.html('');
            collection.sort(function (a, b) {
                return (a.date > b.date) ? 1 : -1;
            });
            for (i = 0; i < collection.length; i += 1) {
                curamountid = $el.attr('id') + '-amount-' + collection[i].id;
                $el.append(
                    '<tr data-id="' + collection[i].id + '">' +
                        '<td>' + escapeHtml(moment(new Date(collection[i].date)).format('DD.MM.YYYY')) + '</td>' +
                        '<td>' + escapeHtml(collection[i].subject) + '</td>' +
                        '<td class="autonumeric" id="' + curamountid + '">' + escapeHtml(collection[i].amount) + '</td>' +
                        '</tr>'
                );
                try {
                    $('#' + curamountid).autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});

                    // get amount as number to compute sum
                    curamount = $('#' + curamountid).autoNumeric('get');
                    sum += parseFloat(curamount);
                } catch (e) {
                    // TODO validation failed, collection[i].amount is not numeric
                    window.console.log('non-numerical amount');
                }
            }

            // add final sum row to table
            $el.append(
                '<tr>' +
                    '<td></td>' +
                    '<td><b>Summa summarum:</b></td>' +
                    '<td style="font-weight: bold;" class="autonumeric" id="' + $el.attr('id') + '-sum-row' + '"><b>' + sum + '</b></td>' +
                    '</tr>'
            );
            $('#' + $el.attr('id') + '-sum-row').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});

            // update sum display
            roundedsum = Math.round(sum);
            $('.' + $el.attr('id') + '-sum').html(roundedsum + ' €');
            if (roundedsum <= 0) {
                $('.' + $el.attr('id') + '-sum').addClass('negative-sum');
            }
        }

        this.add = function (transaction) {
            collection.push(transaction);
            paint();
        };

        this.update = function (transaction) {
            collection[getTransactionItemIndexById(transaction.id)] = transaction;
            paint();
        };

        this.remove = function (transaction) {
            collection.splice(getTransactionItemIndexById(transaction.id), 1);
            paint();
        };

        this.clear = function () {
            collection = [];
            paint();
        };

        this.getSum = function () {
            return sum;
        };
    };

    // APP ------------------------------------------
    // Generic class for a Whyllet App
    App = function (basename) {
        this.basename = basename;
        var transactions = new Transactions($('#' + this.basename + '-transactions')),
            memo;

        // initial load of all transactions from the store
        hoodie.store.findAll(this.basename + 'item').then(function (items) {
            items.forEach(transactions.add);
        });
        this.transactions = transactions;

        // when a transaction changes, update the UI
        hoodie.store.on(this.basename + 'item:add', this.transactions.add);
        hoodie.store.on(this.basename + 'item:update', this.transactions.update);
        hoodie.store.on(this.basename + 'item:remove', this.transactions.remove);
        // clear items when user logs out
        hoodie.account.on('signout', this.transactions.clear);

        // load the "memo to myself"
        hoodie.store.find(this.basename + 'memo', this.basename + 'memo').done(function (item) {
            memo = item;
            $('#spend-memo-change').addClass('hidden');
            $('#spend-memo-show-amount').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#spend-memo-show-amount').autoNumeric('set', escapeHtml(item.amount));
            $('#spend-memo').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#spend-memo').autoNumeric('set', escapeHtml(item.amount));
            $('#spend-memo-show').removeClass('hidden');
        });
        this.memo = memo;

        // when memo changes, update the UI
        this.updateMemo = function (item) {
            $('#spend-memo-change').addClass('hidden');
            $('#spend-memo-show-amount').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#spend-memo-show-amount').autoNumeric('set', escapeHtml(item.amount));
            $('#spend-memo').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#spend-memo').autoNumeric('set', escapeHtml(item.amount));
            $('#spend-memo-show').removeClass('hidden');
        };
        hoodie.store.on(this.basename + 'memo:add', this.updateMemo);
        hoodie.store.on(this.basename + 'memo:update', this.updateMemo);

        // handle click on change memo link
        $('#spend-memo-changeit').on('click', function (event) {
            event.preventDefault();
            $('#spend-memo-change').removeClass('hidden');
            $('#spend-memo-show').addClass('hidden');
        });

        // on submit
        $('#' + this.basename + '-panel').on('submit', function (event) {
            event.preventDefault();

            // fetch form data
            var inputMemo = $('#' + basename + '-memo'),
                inputDate = $('#' + basename + '-input-date'),
                inputSubject = $('#' + basename + '-input-subject'),
                inputAmount = $('#' + basename + '-input-amount'),
                rawDate = inputDate.val(),
                rawSubject = inputSubject.val(),
                rawAmount = inputAmount.val(),
                strMemo = inputMemo.autoNumeric('get'),
                valDate,
                strDate,
                strSubject,
                strAmount;

            // save the "memo to myself"
            if (!$('#spend-memo-change').hasClass('hidden')) {
                // TODO Handle fail case
                hoodie.store.updateOrAdd(basename + 'memo', basename + 'memo', {
                    amount: strMemo
                });
                $('#spend-memo-change').addClass('hidden');
                $('#spend-memo-show').removeClass('hidden');
            }

            // create a new item
            if (rawDate || rawSubject || rawAmount) {

                // 1. validate date
                valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'MM/DD/YYYY']);
                if (!valDate.isValid) {
                    // TODO handle invalid date, error message & return without saving
                    window.console.log('invalid date');
                    return;
                }
                strDate = valDate.toDate().toISOString();

                // 2. validate subject (escape HTML)
                /*strSubject = escapeHtml(rawSubject);*/
                // changed: don't escape anything here (but on output) to avoid escaping it twice
                strSubject = rawSubject;

                // 3. validate amount
                strAmount = inputAmount.autoNumeric('get');
                if (!strAmount || strAmount === 0) {
                    // TODO handle empty amount field
                    window.console.log('empty amount');
                    return;
                }
                // make it a negative value
                if (strAmount > 0) {
                    strAmount *= -1;
                }

                // persist new item
                // TODO handle fail callback
                hoodie.store.add(basename + 'item', {
                    date: strDate,
                    subject: strSubject,
                    amount: strAmount
                });
                inputDate.val('');
                inputSubject.val('');
                inputAmount.val('');

                // dbs = moment('7.06.2015', ['DD.MM.YY', 'DD.MM.YYYY', 'MM/DD/YYYY']).toDate().toISOString();
                // whs = moment(new Date(dbs)).format('DD.MM.YYYY');
            }
        });
    };

    // MAIN FUNCTION --------------------------------
    // execute when DOM is ready
    $(function () {
        var blinkHand,
            spendApp;

        // enable autoNumeric to help entering currency data
        $('.autonumeric').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});

        // insert today's date as default
        $('.insertToday').val(moment().format('DD.MM.YYYY'));

        // INCOME INPUT -----------------------------
        // let the income hand blink
        blinkHand = function () {
            setTimeout(function () { $('#income-hand').toggleClass('text-success'); blinkHand(); }, 1000);
        };
        blinkHand();

        // on submit of new income open distribution form
        $('#income-new-form').on('submit', function (event) {
            event.preventDefault();
            $('#income-dist-div').removeClass('hidden');
        });

        // close distribution panel on click on the upper right x
        $('#income-dist-div-close').on('click', function (event) {
            $('#income-dist-div').addClass('hidden');
        });

        $('#income-dist-form').on('submit', function (event) {
            event.preventDefault();
            // fetch income distribution
            var rawDate = $('#income-date').val(),
                valDate,
                strDate,
                strSubject = $('#income-subject').val(),
                strAmount = $('#income-amount').autoNumeric('get'),
                strSpend = $('#income-spend').autoNumeric('get'),
                strContracts = $('#income-contracts').autoNumeric('get'),
                strSave = $('#income-save').autoNumeric('get'),
                strInvest = $('#income-invest').autoNumeric('get'),
                strGive = $('#income-give').autoNumeric('get'),
                incomeId = -1;

            valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'MM/DD/YYYY']);
            if (!valDate.isValid) {
                // TODO handle invalid date, error message & return without saving
                window.console.log('invalid date');
                return;
            }
            strDate = valDate.toDate().toISOString();

            // add to Hoodie store
            // TODO handle fail callback on every add
            hoodie.store.add('income', {
                date: strDate,
                subject: strSubject,
                amount: strSpend
            }).done(function (income) {
                incomeId = income.id;
            });
            hoodie.store.add('spenditem', {
                date: strDate,
                subject: strSubject,
                amount: strSpend,
                income: incomeId
            });
            hoodie.store.add('contractsitem', {
                date: strDate,
                subject: strSubject,
                amount: strContracts,
                income: incomeId
            });
            hoodie.store.add('saveitem', {
                date: strDate,
                subject: strSubject,
                amount: strSave,
                income: incomeId
            });
            hoodie.store.add('investitem', {
                date: strDate,
                subject: strSubject,
                amount: strInvest,
                income: incomeId
            });
            hoodie.store.add('giveitem', {
                date: strDate,
                subject: strSubject,
                amount: strGive,
                income: incomeId
            });

            // success! reset input fields
            $('.income-input').val('');
            $('#income-date').val(moment().format('DD.MM.YYYY'));
            $('#income-dist-div').addClass('hidden');
        });

        // create apps
        spendApp = new App('spend');
    });
}());
