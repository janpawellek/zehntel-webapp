/*global $,moment,Hoodie*/
(function () {
    "use strict";
    var hoodie,
        Piggybank,
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
                        '<td class="transaction-date">' + escapeHtml(moment(new Date(collection[i].date)).format('DD.MM.YYYY')) + '</td>' +
                        '<td class="transaction-subject">' + escapeHtml(collection[i].subject) + '</td>' +
                        '<td class="transaction-amount autonumeric" id="' + curamountid + '">' + escapeHtml(collection[i].amount) + '</td>' +
                        '<td class="transaction-dropdown" style="padding: 5px;">' +
                        '<div class="btn-group">' +
                        '<button type="button" class="btn btn-default btn-xs dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' +
                        '<span class="caret"></span>' +
                        '<span class="sr-only">Menü öffnen</span>' +
                        '</button>' +
                        '<ul class="dropdown-menu dropdown-menu-right">' +
                        '<li><a href="#" class="do-edit-transaction" data-edit="' + collection[i].id + '">Eintrag ändern</a></li>' +
                        '<li><a href="#" class="do-delete-transaction" data-delete="' + collection[i].id + '">Eintrag löschen</a></li>' +
                        '</ul>' +
                        '</div>' +
                        '</td>' +
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

            // register event handler to edit and delete items
            $('.do-edit-transaction').click(function (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
                var toeditid = $(event.target).attr('data-edit'),
                    toeditdate = $('tr[data-id=' + toeditid + '] .transaction-date').text(),
                    toeditsubject = $('tr[data-id=' + toeditid + '] .transaction-subject').text(),
                    toeditamount = $('tr[data-id=' + toeditid + '] .transaction-amount').text();

                // create inputs to edit item
                $('tr[data-id=' + toeditid + '] .transaction-date').html('');
                $('tr[data-id=' + toeditid + '] .transaction-date').append(
                    '<input type="text" class="form-control input-sm onLogoffClearVal" class="edit-input-date" data-transaction="' + toeditid + '" value="' + toeditdate + '">'
                );
                $('tr[data-id=' + toeditid + '] .transaction-subject').html('');
                $('tr[data-id=' + toeditid + '] .transaction-subject').append(
                    '<input type="text" class="form-control input-sm onLogoffClearVal" class="edit-input-subject" data-transaction="' + toeditid + '" value="' + toeditsubject + '">'
                );
                $('tr[data-id=' + toeditid + '] .transaction-amount').html('');
                $('tr[data-id=' + toeditid + '] .transaction-amount').append(
                    '<input type="text" class="form-control input-sm onLogoffClearVal autonumeric" class="edit-input-amount" data-transaction="' + toeditid + '">'
                );
                $('tr[data-id=' + toeditid + '] .transaction-amount input').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
                $('tr[data-id=' + toeditid + '] .transaction-amount input').autoNumeric('set', escapeHtml(toeditamount.replace(' €', '').replace(',', '.')));
                $('tr[data-id=' + toeditid + '] .transaction-dropdown').html('');
                $('tr[data-id=' + toeditid + '] .transaction-dropdown').append(
                    '<button type="submit" class="btn btn-success btn-sm do-confirm-edit-transaction" data-transaction="' + toeditid + '">OK</button>'
                );

                // event handler to save changes
                $('.do-confirm-edit-transaction').click(function (event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    var tosaveid = $(event.target).attr('data-transaction'),
                        rawDate = $('tr[data-id=' + toeditid + '] .transaction-date input').val(),
                        rawSubject = $('tr[data-id=' + toeditid + '] .transaction-subject input').val(),
                        valDate,
                        strDate,
                        strAmount,
                        strSubject;

                    // 1. validate date
                    valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'MM/DD/YYYY']);
                    if (!valDate.isValid) {
                        // TODO handle invalid date, error message & return without saving
                        window.console.log('invalid date');
                        return;
                    }
                    strDate = valDate.toDate().toISOString();

                    // 2. validate subject
                    strSubject = rawSubject;

                    // 3. validate amount
                    strAmount = $('tr[data-id=' + toeditid + '] .transaction-amount input').autoNumeric('get');
                    if (!strAmount || strAmount === 0) {
                        // TODO handle empty amount field
                        window.console.log('empty amount');
                        return;
                    }

                    hoodie.store.update($el.attr('id').replace('-transactions', '') + 'item', tosaveid, {
                        date: strDate,
                        subject: strSubject,
                        amount: strAmount
                    })
                        .fail(function (error) {
                            // TODO handle update error
                            window.alert('Update error: ' + error.message);
                        });
                });
            });
            $('.do-delete-transaction').click(function (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
                var todeleteid = $(event.target).attr('data-delete');
                // TODO show confirmation dialog in advance
                hoodie.store.remove($el.attr('id').replace('-transactions', '') + 'item', todeleteid)
                    .fail(function (error) {
                        // TODO handle deletion error
                        window.alert('Deletion error: ' + error.message);
                    });
            });

            // add final sum row to table
            $el.append(
                '<tr>' +
                    '<td></td>' +
                    '<td><b>Verfügbar in diesem Sparschwein:</b></td>' +
                    '<td style="font-weight: bold;" class="autonumeric" id="' + $el.attr('id') + '-sum-row' + '"><b>' + sum + '</b></td>' +
                    '<td></td>' +
                    '</tr>'
            );
            $('#' + $el.attr('id') + '-sum-row').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});

            // update sum display
            roundedsum = Math.round(sum);
            $('.' + $el.attr('id') + '-sum').html(roundedsum + ' €');
            if (roundedsum <= 0) {
                $('.' + $el.attr('id') + '-sum').addClass('negative-sum');
            } else {
                $('.' + $el.attr('id') + '-sum').removeClass('negative-sum');
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

    // PIGGYBANK ------------------------------------------
    // Generic class for a Zehntel Piggybank
    Piggybank = function (basename) {
        this.basename = basename;
        var transactions = new Transactions($('#' + this.basename + '-transactions')),
            memo,

            // helper function to toggle onEmpty classes
            addTransaction = function (transaction) {
                $('#' + basename + '-panel .onEmptyShow').addClass('hidden');
                $('#' + basename + '-panel .onEmptyHide').removeClass('hidden');
                $('#' + basename + '-tab .onEmptyShow').addClass('hidden');
                $('#' + basename + '-tab .onEmptyHide').removeClass('hidden');
                transactions.add(transaction);
            },

            // helper function to load all transactions from the store
            loadTransactions = function () {
                hoodie.store.findAll(basename + 'item').then(function (items) {
                    items.forEach(addTransaction);
                });
            };

        // initial load of all transactions from the store
        loadTransactions();
        this.transactions = transactions;

        // when a transaction changes, update the UI
        hoodie.store.on(this.basename + 'item:add', addTransaction);
        hoodie.store.on(this.basename + 'item:update', this.transactions.update);
        hoodie.store.on(this.basename + 'item:remove', this.transactions.remove);
        // clear items when user logs out
        hoodie.account.on('signout', this.transactions.clear);

        // load the "memo to myself"
        hoodie.store.find(this.basename + 'memo', this.basename + 'memo').done(function (item) {
            memo = item;
            $('#' + basename + '-memo-change').addClass('hidden');
            $('#' + basename + '-memo-show-amount').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#' + basename + '-memo-show-amount').autoNumeric('set', escapeHtml(item.amount));
            $('#' + basename + '-memo').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#' + basename + '-memo').autoNumeric('set', escapeHtml(item.amount));
            $('#' + basename + '-memo-show').removeClass('hidden');
        });
        this.memo = memo;

        // when memo changes, update the UI
        this.updateMemo = function (item) {
            $('#' + basename + '-memo-change').addClass('hidden');
            $('#' + basename + '-memo-show-amount').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#' + basename + '-memo-show-amount').autoNumeric('set', escapeHtml(item.amount));
            $('#' + basename + '-memo').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#' + basename + '-memo').autoNumeric('set', escapeHtml(item.amount));
            $('#' + basename + '-memo-show').removeClass('hidden');
        };
        hoodie.store.on(this.basename + 'memo:add', this.updateMemo);
        hoodie.store.on(this.basename + 'memo:update', this.updateMemo);

        // handle click on change memo link
        $('#' + this.basename + '-memo-changeit').on('click', function (event) {
            event.preventDefault();
            $('#' + basename + '-memo-change').removeClass('hidden');
            $('#' + basename + '-memo-show').addClass('hidden');
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
            if (!$('#' + this.basename + '-memo-change').hasClass('hidden') && strMemo > 0) {
                // TODO Handle fail case
                hoodie.store.updateOrAdd(basename + 'memo', basename + 'memo', {
                    amount: strMemo
                });
                $('#' + this.basename + '-memo-change').addClass('hidden');
                $('#' + this.basename + '-memo-show').removeClass('hidden');
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
                inputDate.val(moment().format('DD.MM.YYYY'));
                inputSubject.val('');
                inputAmount.val('');

                // dbs = moment('7.06.2015', ['DD.MM.YY', 'DD.MM.YYYY', 'MM/DD/YYYY']).toDate().toISOString();
                // whs = moment(new Date(dbs)).format('DD.MM.YYYY');
            }
        });
    };

    // ACCOUNT FUNCTIONALITY (LOGIN/LOGOUT) -----------------------------------
    function setLoggedIn(state) {
        if (state) {
            // set page layout to logged in state
            $('.onLoginClearVal').val('');
            $('.onLoginHide').addClass('hidden');
            $('.onLoginShow').removeClass('hidden');

            // hide login dialog and show user name
            $('#loginModal').modal('hide');
            $('.hoodieUsername').html(hoodie.account.username);
        } else {
            // set page layout to logged out state
            $('.onLogoffShow').removeClass('hidden');
            $('.onLogoffHide').addClass('hidden');
            $('.onEmptyShow').removeClass('hidden');
            $('.onEmptyHide').addClass('hidden');

            // important: clear everything in the DOM from the previously logged in user
            $('.onLogoffClearContent').html('');
            $('.onLogoffClearVal').val('');

            // insert today's date as default
            $('.insertToday').val(moment().format('DD.MM.YYYY'));
        }
    }

    // LOGIN FORM SUBMIT
    $('#loginForm').submit(function (event) {
        event.preventDefault();
        var username = $('#loginName').val(),
            password = $('#loginPassword').val();

        hoodie.account.signIn(username, password)
            .done(
                function () {
                    // login successful
                    setLoggedIn(true);
                }
            ).fail(
                function () {
                    // login failed
                    $('#loginFailed').removeClass('hidden');
                    setLoggedIn(false);
                }
            );
    });

    $('#logoutButton').click(function () {
        hoodie.account.signOut();
        setLoggedIn(false);
    });

    hoodie.account.on('error:unauthenticated signout', function () {
        setLoggedIn(false);
    });

    hoodie.account.on('signin signup', function () {
        setLoggedIn(true);
    });

    // MAIN FUNCTION --------------------------------
    // execute when DOM is ready
    $(function () {
        var blinkHand,
            connectionCheck,
            spendPiggy,
            contractsPiggy,
            savePiggy,
            investPiggy,
            givePiggy;

        // enable tooltips
        $('[data-toggle="tooltip"]').tooltip();

        // enable autoNumeric to help entering currency data
        $('.autonumeric').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});

        // insert today's date as default
        $('.insertToday').val(moment().format('DD.MM.YYYY'));

        // initialize the connection checker
        connectionCheck = function () {
            setTimeout(function () {
                hoodie.checkConnection()
                    .done(function () {
                        $('.connectionOnline').removeClass('hidden');
                        $('.connectionOffline').addClass('hidden');
                    })
                    .fail(function () {
                        $('.connectionOnline').addClass('hidden');
                        $('.connectionOffline').removeClass('hidden');
                    });
                connectionCheck();
            }, 1000);
        };
        connectionCheck();

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

            // TODO check if sum of distributed income is equal to total income
            // TODO fail & return if total income is not strictly positive
            // TODO initialize autoNumeric for input fields such that no negative input is allowed

            // add to Hoodie store
            // TODO handle fail callback on every add
            hoodie.store.add('income', {
                date: strDate,
                subject: strSubject,
                amount: strAmount
            }).done(function (income) {
                incomeId = income.id;
            });
            if (strSpend > 0) {
                hoodie.store.add('spenditem', {
                    date: strDate,
                    subject: strSubject,
                    amount: strSpend,
                    income: incomeId
                });
            }
            if (strContracts > 0) {
                hoodie.store.add('contractsitem', {
                    date: strDate,
                    subject: strSubject,
                    amount: strContracts,
                    income: incomeId
                });
            }
            if (strSave > 0) {
                hoodie.store.add('saveitem', {
                    date: strDate,
                    subject: strSubject,
                    amount: strSave,
                    income: incomeId
                });
            }
            if (strInvest > 0) {
                hoodie.store.add('investitem', {
                    date: strDate,
                    subject: strSubject,
                    amount: strInvest,
                    income: incomeId
                });
            }
            if (strGive > 0) {
                hoodie.store.add('giveitem', {
                    date: strDate,
                    subject: strSubject,
                    amount: strGive,
                    income: incomeId
                });
            }

            // success! reset input fields
            $('.income-input').val('');
            $('#income-date').val(moment().format('DD.MM.YYYY'));
            $('#income-dist-div').addClass('hidden');
        });

        // create piggys
        spendPiggy = new Piggybank('spend');
        contractsPiggy = new Piggybank('contracts');
        savePiggy = new Piggybank('save');
        investPiggy = new Piggybank('invest');
        givePiggy = new Piggybank('give');

        // set initial login/logout state
        if (hoodie.account.username === undefined) {
            setLoggedIn(false);
        } else {
            setLoggedIn(true);
        }

        $('.onHoodieReadyHide').addClass('hidden');
        $('.onHoodieReadyShow').removeClass('hidden');
    });
}());
