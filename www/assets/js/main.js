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

    // helper function to show the message modal
    function messageModal(strTitle, strContent, strButton) {
        $('#messageModalLabel').html(strTitle);
        $('#messageModalContent').html(strContent);
        $('#messageModalButton').html(strButton);
        $('#messageModal').modal('show');
    }
    $('#messageModalButton').click(function (event) {
        $('#messageModal').modal('hide');
    });
    function showHoodieError(message) {
        messageModal('Bitte entschuldige',
                     'Leider hat das gerade nicht funktioniert. Versuche es bitte noch einmal. Falls dieses Problem wieder auftritt, lade bitte die Seite neu.' +
                     'Wenn das nicht hilft, wende dich bitte an <a href="mailto:team@zehntel.org">team@zehntel.org</a>. Bitte verzeihe uns die Unannehmlichkeiten.' +
                     '<br><br>Das System meldet: <i>' + message + '</i>',
                     'OK');
    }

    // helper function to show the dialog modal
    function dialogModal(strTitle, strContent, strButtonOk, strButtonCancel, onOk, onCancel, isOkGreen) {
        $('#dialogModalLabel').html(strTitle);
        $('#dialogModalContent').html(strContent);
        $('#dialogModalButtonOk').html(strButtonOk);
        $('#dialogModalButtonCancel').html(strButtonCancel);

        if (isOkGreen) {
            $('#dialogModalButtonOk').removeClass('btn-danger');
            $('#dialogModalButtonOk').addClass('btn-success');
            $('#dialogModalButtonCancel').addClass('btn-danger');
            $('#dialogModalButtonCancel').removeClass('btn-success');
        } else {
            $('#dialogModalButtonOk').addClass('btn-danger');
            $('#dialogModalButtonOk').removeClass('btn-success');
            $('#dialogModalButtonCancel').removeClass('btn-danger');
            $('#dialogModalButtonCancel').addClass('btn-success');
        }

        $('#dialogModal').modal('show');

        $('#dialogModalButtonOk').off('click');
        $('#dialogModalButtonOk').click(function (event) {
            $('#dialogModal').modal('hide');
            onOk();
        });
        $('#dialogModalButtonCancel').off('click');
        $('#dialogModalButtonCancel').click(function (event) {
            $('#dialogModal').modal('hide');
            onCancel();
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
            $('.onIncomeHide').addClass('hidden');
            sum = 0.0;
            $el.html('');
            collection.sort(function (a, b) {
                return (a.date > b.date) ? 1 : -1;
            });
            for (i = 0; i < collection.length; i += 1) {
                curamountid = $el.attr('id') + '-amount-' + collection[i].id;
                // console.log(collection[i]);
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
                        '<li><a href="#" class="do-edit-transaction" data-edit="' + collection[i].id + '" data-type="' + $el.attr('id').replace('-transactions', '') + 'item' + '">Eintrag ändern</a></li>' +
                        '<li><a href="#" class="do-delete-transaction" data-delete="' + collection[i].id + '" data-type="' + $el.attr('id').replace('-transactions', '') + 'item' + '">Eintrag löschen</a></li>' +
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
                    // collection[i].amount is not numeric
                }
            }

            // register event handler to edit and delete items
            $('.do-edit-transaction').off('click');
            $('.do-edit-transaction').click(function (event) {
                event.preventDefault();
                var toeditid = $(event.target).attr('data-edit'),
                    toedittype = $(event.target).attr('data-type'),
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
                $('tr[data-id=' + toeditid + '] .do-confirm-edit-transaction').off('click');
                $('tr[data-id=' + toeditid + '] .do-confirm-edit-transaction').click(function (event) {
                    event.preventDefault();
                    var tosaveid = $(event.target).attr('data-transaction'),
                        rawDate = $('tr[data-id=' + toeditid + '] .transaction-date input').val(),
                        rawSubject = $('tr[data-id=' + toeditid + '] .transaction-subject input').val(),
                        valDate,
                        strDate,
                        strAmount,
                        strSubject;

                    // 1. validate date
                    valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'D.M.YYYY', 'D.M.YY', 'MM/DD/YYYY', 'YYYY/MM/DD'], true);
                    if (!valDate.isValid()) {
                        messageModal('Hoppla',
                                     'Bitte gib das Datum im Format TT.MM.JJJJ an, z.B. ' + moment().format('DD.MM.YYYY') + '. Vielen Dank!',
                                     'OK');
                        return;
                    }
                    strDate = valDate.toDate().toISOString();

                    // 2. get subject
                    strSubject = rawSubject;

                    // 3. get amount
                    strAmount = $('tr[data-id=' + toeditid + '] .transaction-amount input').autoNumeric('get');
                    if (!strAmount) {
                        strAmount = 0.0;
                    }

                    hoodie.store.update(toedittype, tosaveid, {
                        date: strDate,
                        subject: strSubject,
                        amount: strAmount,
                        updated: moment().toDate()
                    }).fail(function (error) {
                        showHoodieError(error.message);
                    });
                });
            });
            $('.do-delete-transaction').off('click');
            $('.do-delete-transaction').click(function (event) {
                event.preventDefault();
                var todeleteid = $(event.target).attr('data-delete'),
                    todeletetype = $(event.target).attr('data-type');

                // show confirmation dialog in advance
                dialogModal('Wirklich löschen?',
                            'Wenn ich den Eintrag für dich lösche, kann das nicht rückgängig gemacht werden. Bist du sicher, dass du den Eintrag <b>' +
                            $('tr[data-id=' + todeleteid + '] .transaction-subject').html() +
                            '</b> löschen möchtest?',
                            'Löschen',
                            'Behalten',
                            function () { hoodie.store.remove(todeletetype, todeleteid)
                                .fail(function (error) { showHoodieError(error.message); });
                            },
                            function () { $('tr[data-id=' + todeleteid + '] .transaction-dropdown .dropdown-menu').dropdown('toggle'); },
                            false);
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

        this.add = function (transaction, doRepaint) {
            // console.log($el.attr('id') + ' ADD ' + transaction.id);
            if (hoodie.account.username === undefined) {
                $('#signupSuggestion').removeClass('hidden');
            }
            collection.push(transaction);
            if (doRepaint) {
                paint();
            }
        };

        this.update = function (transaction) {
            var txindex = getTransactionItemIndexById(transaction.id);
            // console.log($el.attr('id') + ' UPDATE ' + transaction.id);
            if (txindex === null) {
                // add to collection if this transaction does not exist yet
                // (happens on {moveData: true} on login)
                collection.push(transaction);
            } else {
                // just update the transaction
                collection[txindex] = transaction;
            }
            paint();
        };

        this.remove = function (transaction) {
            // console.log($el.attr('id') + ' REMOVE ' + transaction.id);
            collection.splice(getTransactionItemIndexById(transaction.id), 1);
            paint();
        };

        this.clear = function () {
            // console.log($el.attr('id') + ' CLEAR');
            collection = [];
            paint();
        };

        this.getSum = function () {
            return sum;
        };

        this.repaint = function () {
            paint();
        };
    };

    // PIGGYBANK ------------------------------------------
    // Generic class for a Zehntel Piggybank
    Piggybank = function (basename) {
        this.basename = basename;
        var transactions = new Transactions($('#' + this.basename + '-transactions')),
            memo,

            // helper function to toggle onEmpty classes
            addTransaction = function (transaction, doRepaint) {
                $('#' + basename + '-panel .onEmptyShow').addClass('hidden');
                $('#' + basename + '-panel .onEmptyHide').removeClass('hidden');
                $('#' + basename + '-tab .onEmptyShow').addClass('hidden');
                $('#' + basename + '-tab .onEmptyHide').removeClass('hidden');
                transactions.add(transaction, doRepaint);
            },

            // helper function to load all transactions from the store
            loadTransactions = function () {
                hoodie.store.findAll(basename + 'item').then(function (items) {
                    items.forEach(function (transaction) { addTransaction(transaction, false); });
                    if (items.length) {
                        transactions.repaint();
                    }
                }).fail(function (error) {
                    showHoodieError(error.message);
                });
            };

        // initial load of all transactions from the store
        loadTransactions();
        this.transactions = transactions;

        // when a transaction changes, update the UI
        hoodie.store.on(this.basename + 'item:add', function (transaction) { addTransaction(transaction, true); });
        hoodie.store.on(this.basename + 'item:update', this.transactions.update);
        hoodie.store.on(this.basename + 'item:remove', this.transactions.remove);
        // clear items when user logs out
        hoodie.account.on('signup signin signout', this.transactions.clear);

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
                hoodie.store.updateOrAdd(basename + 'memo', basename + 'memo', {
                    amount: strMemo,
                    updated: moment().toDate()
                }).fail(function (error) {
                    showHoodieError(error.message);
                });
                $('#' + this.basename + '-memo-change').addClass('hidden');
                $('#' + this.basename + '-memo-show').removeClass('hidden');
            }

            // create a new item
            if (rawDate || rawSubject || rawAmount) {

                // 1. validate date
                valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'D.M.YYYY', 'D.M.YY', 'MM/DD/YYYY', 'YYYY/MM/DD'], true);
                if (!valDate.isValid()) {
                    messageModal('Hoppla',
                                 'Bitte gib das Datum im Format TT.MM.JJJJ an, z.B. ' + moment().format('DD.MM.YYYY') + '. Vielen Dank!',
                                 'OK');
                    return;
                }
                strDate = valDate.toDate().toISOString();

                // 2. get subject
                strSubject = rawSubject;

                // 3. get amount
                strAmount = inputAmount.autoNumeric('get');
                if (!strAmount) {
                    return;
                }
                // make it a negative value
                if (strAmount > 0) {
                    strAmount *= -1;
                }

                // persist new item
                hoodie.store.add(basename + 'item', {
                    date: strDate,
                    subject: strSubject,
                    amount: strAmount
                }).fail(function (error) {
                    showHoodieError(error.message);
                });
                inputDate.val(moment().format('DD.MM.YYYY'));
                inputSubject.val('');
                inputAmount.val('');
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
            password = $('#loginPassword').val(),
            passwordRepeat = $('#loginPasswordRepeat').val(),
            email = $('#loginEmail').val(),
            signInOrUp = function (moveData) {
                if ($('input[type=radio][name=loginSignupOption]:checked').val() === 'signup') {
                    // sign up as a new user

                    if (!username || !password) {
                        $('#signupFailed').removeClass('hidden');
                        $('#signupFailed').html('Bitte gib einen Namen (kann auch ein Fantasiename sein) und ein Passwort ein.');
                        return;
                    }

                    if (password !== passwordRepeat) {
                        $('#signupFailed').removeClass('hidden');
                        $('#signupFailed').html('Das Passwort und die Passwortbestätigung stimmen nicht überein. Bitte stelle sicher, dass du dich nicht vertippt hast.');
                        return;
                    }

                    // { moveData: false } is not yet implemented in hoodie.account.signUp
                    // thus, delete everything by hand if moveData is false
                    if (!moveData) {
                        hoodie.account.destroy()
                            .done(function () {
                                signInOrUp(true);
                            })
                            .fail(function (error) {
                                showHoodieError(error.message);
                            });
                        return;
                    }
                    hoodie.account.signUp(username, password, {moveData: moveData})
                        .done(
                            function () {
                                // signup successful
                                setLoggedIn(true);

                                // set e-mail
                                if (email) {
                                    hoodie.store.add('userinfo', { id: 'useremail', email: email })
                                        .fail(
                                            function (error) {
                                                showHoodieError(error.message);
                                            }
                                        );
                                }
                            }
                        ).fail(
                            function (error) {
                                // signup failed
                                if (error.name === 'HoodieConflictError') {
                                    $('#signupFailed').removeClass('hidden');
                                    $('#signupFailed').html('Dieser Name ist bereits bei Zehntel.org registriert. Bitte wähle einen anderen Namen.');
                                    return;
                                }
                                $('#loginFailedDetail').html(error.message);
                                $('#loginFailed').removeClass('hidden');
                                setLoggedIn(false);
                            }
                        );
                } else {
                    // sign in using existing credentials
                    hoodie.account.signIn(username, password, {moveData: moveData})
                        .done(
                            function () {
                                // login successful
                                setLoggedIn(true);
                            }
                        ).fail(
                            function (error) {
                                // login failed
                                $('#loginFailedDetail').html(error.message);
                                $('#loginFailed').removeClass('hidden');
                                setLoggedIn(false);
                            }
                        );
                }
            };

        // hide previous errors
        $('#signupFailed, #loginFailed').addClass('hidden');

        // ask whether anonymously entered data should be kept
        if (!$('#signupSuggestion').hasClass('hidden')) {
            dialogModal('Daten behalten?',
                        'Du hast gerade eben vor deiner Anmeldung Daten in Zehntel.org eingetragen. Möchtest du diese Einträge in deinen Account übernehmen?',
                        'Daten übernehmen',
                        'Daten verwerfen',
                        function () { signInOrUp(true); },
                        function () { signInOrUp(false); },
                        true);
        } else {
            signInOrUp(false);
        }
    });

    $('#logoutButton').click(function () {
        hoodie.account.signOut()
            .done(
                function () {
                    // logout successful
                    setLoggedIn(false);
                }
            ).fail(
                function (error) {
                    // logout failed
                    showHoodieError(error.message);
                }
            );
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
            updateIncomeSum,
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

        // show additional fields when the user wants to signUP
        $('input[type=radio][name=loginSignupOption]').change(function () {
            if (this.value === 'signin') {
                $('.loginSignup').addClass('hidden');
            }
            if (this.value === 'signup') {
                $('.loginSignup').removeClass('hidden');
            }
        });
        if ($('input[type=radio][name=loginSignupOption]:checked').val() === 'signup') {
            $('.loginSignup').removeClass('hidden');
        }

        // INCOME INPUT -----------------------------
        // let the income hand blink
        blinkHand = function () {
            setTimeout(function () { $('#income-hand').toggleClass('text-success'); blinkHand(); }, 1000);
        };
        blinkHand();

        // helper function to update the percentage and the remaining amount of income
        updateIncomeSum = function () {
            var strAmount = $('#income-amount').autoNumeric('get'),
                strSpend = $('#income-spend').autoNumeric('get'),
                strContracts = $('#income-contracts').autoNumeric('get'),
                strSave = $('#income-save').autoNumeric('get'),
                strInvest = $('#income-invest').autoNumeric('get'),
                strGive = $('#income-give').autoNumeric('get'),
                remainingSum,
                givePercentage;

            remainingSum = strAmount - strSpend - strContracts - strSave - strInvest - strGive;
            $('#income-sum-text').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
            $('#income-sum-text').autoNumeric('set', escapeHtml(remainingSum));
            if (remainingSum < -0.001) {
                $('#income-sum-text').addClass('negative-sum');
            } else {
                $('#income-sum-text').removeClass('negative-sum');
            }

            givePercentage = (100 * strGive / strAmount).toFixed(0);
            $('#income-give-percentage').html(givePercentage + ' %');
        };

        // on submit of new income open distribution form
        $('#income-new-form').on('submit', function (event) {
            event.preventDefault();
            if (!$('#income-amount').autoNumeric('get')) {
                return;
            }

            $('#income-dist-div').removeClass('hidden');

            // check if there is a previous item with the same amount - if so, fill all input forms with the last values
            hoodie.store.findAll(function (object) {
                return object.type === 'income' && object.amount === $('#income-amount').autoNumeric('get');
            }).done(function (sameAmountItems) {
                if (sameAmountItems.length > 0) {
                    // fetch the ID of the latest item with this amount
                    var lastid = sameAmountItems.sort(function (a, b) {
                        return b.createdAt - a.createdAt;
                    })[0].id;

                    // set income-spend field
                    hoodie.store.findAll(function (object) {
                        return object.type === 'spenditem' && object.income === lastid;
                    }).done(function (items) {
                        if (items.length > 0) {
                            $('#income-spend').autoNumeric('set', escapeHtml(items[0].amount));
                            updateIncomeSum();
                        }
                    });

                    // set income-contracts field
                    hoodie.store.findAll(function (object) {
                        return object.type === 'contractsitem' && object.income === lastid;
                    }).done(function (items) {
                        if (items.length > 0) {
                            $('#income-contracts').autoNumeric('set', escapeHtml(items[0].amount));
                            updateIncomeSum();
                        }
                    });

                    // set income-save field
                    hoodie.store.findAll(function (object) {
                        return object.type === 'saveitem' && object.income === lastid;
                    }).done(function (items) {
                        if (items.length > 0) {
                            $('#income-save').autoNumeric('set', escapeHtml(items[0].amount));
                            updateIncomeSum();
                        }
                    });

                    // set income-invest field
                    hoodie.store.findAll(function (object) {
                        return object.type === 'investitem' && object.income === lastid;
                    }).done(function (items) {
                        if (items.length > 0) {
                            $('#income-invest').autoNumeric('set', escapeHtml(items[0].amount));
                            updateIncomeSum();
                        }
                    });

                    // set income-give field
                    hoodie.store.findAll(function (object) {
                        return object.type === 'giveitem' && object.income === lastid;
                    }).done(function (items) {
                        if (items.length > 0) {
                            $('#income-give').autoNumeric('set', escapeHtml(items[0].amount));
                            updateIncomeSum();
                        }
                    });
                } else {
                    // calculate 10%
                    $('#income-give').autoNumeric('set', $('#income-amount').autoNumeric('get') * 0.1);
                    updateIncomeSum();
                }
            });
        });

        // close distribution panel on click on the upper right x
        $('#income-dist-div-close').on('click', function (event) {
            $('#income-dist-div').addClass('hidden');
        });

        // update income sum if any field gets changed
        $('.onChangeUpdateIncomeSum').change(updateIncomeSum);

        $('#income-dist-form').on('submit', function (event) {
            event.preventDefault();
            updateIncomeSum();

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
                incomeId = -1,
                remainingSum = strAmount - strSpend - strContracts - strSave - strInvest - strGive;

            valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'D.M.YYYY', 'D.M.YY', 'MM/DD/YYYY', 'YYYY/MM/DD'], true);
            if (!valDate.isValid()) {
                messageModal('Hoppla',
                             'Bitte gib das Datum im Format TT.MM.JJJJ an, z.B. ' + moment().format('DD.MM.YYYY') + '. Vielen Dank!',
                             'OK');
                return;
            }
            strDate = valDate.toDate().toISOString();

            // check if sum of distributed income is equal to total income
            if (remainingSum < -0.001) {
                messageModal('Das kann ich nicht machen',
                             'Du hast mehr Geld aufgeteilt, als du verdient hast. Bitte korrigiere das.',
                             'OK');
                return;
            }

            if (remainingSum > 0.001) {
                dialogModal('Da ist noch etwas übrig',
                            'Du hast noch <b id="remaining-dialog-amount">' + remainingSum + '</b> übrig, die du verteilen kannst. Möchtest du diesen Betrag in dein Zehntel-Sparschwein hinzufügen?',
                            'Ja zum Zehntel addieren',
                            'Nein nochmal nachdenken',
                            function () { $('#income-give').autoNumeric('set', remainingSum + (strGive > 0.001 ? parseFloat(strGive) : 0));
                                          updateIncomeSum(); },
                            function () { },
                            true);
                $('#remaining-dialog-amount').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'});
                return;
            }

            // add to Hoodie store
            hoodie.store.add('income', {
                date: strDate,
                subject: strSubject,
                amount: strAmount
            }).done(function (income) {
                incomeId = income.id;

                if (strSpend > 0) {
                    hoodie.store.add('spenditem', {
                        date: strDate,
                        subject: strSubject,
                        amount: strSpend,
                        income: incomeId
                    }).fail(function (error) {
                        showHoodieError(error.message);
                    });
                }
                if (strContracts > 0) {
                    hoodie.store.add('contractsitem', {
                        date: strDate,
                        subject: strSubject,
                        amount: strContracts,
                        income: incomeId
                    }).fail(function (error) {
                        showHoodieError(error.message);
                    });
                }
                if (strSave > 0) {
                    hoodie.store.add('saveitem', {
                        date: strDate,
                        subject: strSubject,
                        amount: strSave,
                        income: incomeId
                    }).fail(function (error) {
                        showHoodieError(error.message);
                    });
                }
                if (strInvest > 0) {
                    hoodie.store.add('investitem', {
                        date: strDate,
                        subject: strSubject,
                        amount: strInvest,
                        income: incomeId
                    }).fail(function (error) {
                        showHoodieError(error.message);
                    });
                }
                if (strGive > 0) {
                    hoodie.store.add('giveitem', {
                        date: strDate,
                        subject: strSubject,
                        amount: strGive,
                        income: incomeId
                    }).fail(function (error) {
                        showHoodieError(error.message);
                    });
                }

                // success! reset input fields
                $('.income-input').val('');
                $('#income-date').val(moment().format('DD.MM.YYYY'));
                $('#income-dist-div').addClass('hidden');

                // show suggestion to signup
                if (hoodie.account.username === undefined) {
                    $('#signupSuggestion').removeClass('hidden');
                }
            }).fail(function (error) {
                showHoodieError(error.message);
            });
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
