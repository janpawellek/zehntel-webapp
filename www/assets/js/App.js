"use strict";

// Generic class for a Whyllet App
var App = function(basename) {
  this.basename = basename;

  // initial load of all items from the store
  var transactions = new Transactions($('#' + this.basename + '-transactions'));
  hoodie.store.findAll(this.basename + 'item').then(function(items) {
    items.forEach(transactions.add);
  });
  this.transactions = transactions;

  // when an item changes, update the UI
  hoodie.store.on(this.basename + 'item:add', this.transactions.add);
  hoodie.store.on(this.basename + 'item:update', this.transactions.update);
  hoodie.store.on(this.basename + 'item:remove', this.transactions.remove);
  // clear items when user logs out
  hoodie.account.on('signout', this.transactions.clear);

  // on submit
  $('#' + this.basename + '-panel').on('submit', function(event) {
    event.preventDefault();

    // save the "memo to myself"
    var rawMemoVal = $('#' + basename + '-memo').val();
    if (rawMemoVal) {
      // TODO save memo to myself
      console.log('Memo: ' + rawMemoVal);
    };

    // create a new item
    var inputDate = $('#' + basename + '-input-date');
    var inputSubject = $('#' + basename + '-input-subject');
    var inputAmount = $('#' + basename + '-input-amount');
    var rawDate = inputDate.val();
    var rawSubject = inputSubject.val();
    var rawAmount = inputAmount.val();
    if (rawDate || rawSubject || rawAmount) {

      // 1. validate date
      var valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'MM/DD/YYYY']);
      if (!valDate.isValid) {
        // TODO handle invalid date, error message & return without saving
        console.log('invalid date');
        return;
      };
      var strDate = valDate.toDate().toISOString();

      // 2. validate subject (escape HTML)
      /*var strSubject = escapeHtml(rawSubject);*/
      // changed: don't escape anything here (but on output) to avoid escaping it twice
      var strSubject = rawSubject;

      // 3. validate amount
      var strAmount = inputAmount.autoNumeric('get');
      if (!strAmount || strAmount == 0) {
        // TODO handle empty amount field
        console.log('empty amount');
        return;
      };
      // make it a negative value
      if (strAmount > 0) {
        strAmount *= -1;
      };

      // persist new item
      hoodie.store.add(basename + 'item', {
        date: strDate,
        subject: strSubject,
        amount: strAmount,
      });
      inputDate.val('');
      inputSubject.val('');
      inputAmount.val('');

      // dbs = moment('7.06.2015', ['DD.MM.YY', 'DD.MM.YYYY', 'MM/DD/YYYY']).toDate().toISOString();
      // whs = moment(new Date(dbs)).format('DD.MM.YYYY');
    };
  });
};
