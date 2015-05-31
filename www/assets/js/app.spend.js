"use strict";
// initialize Hoodie
// var hoodie = new Hoodie();

var spendings = new Transactions($('#spend-transactions'));

// initial load of all items from the store
hoodie.store.findAll('spending').then(function(allItems) {
  allItems.forEach(spendings.add);
});

// when an item changes, update the UI
hoodie.store.on('spending:add', spendings.add);
hoodie.store.on('spending:update', spendings.update);
hoodie.store.on('spending:remove', spendings.remove);
// clear items when user logs out
hoodie.account.on('signout', spendings.clear);

// handle creating a new item
$('#panel-spend').on('submit', function(event) {
  // TODO differentiate between adding a new spending item
  // and changing the "Memo an mich selbst"
  event.preventDefault();
  // TODO add input validation
  hoodie.store.add('spending', {
    date: $('#spendInputDate').val(),
    subject: $('#spendInputSubject').val(),
    amount: $('#spendInputAmount').val(),
  });
  $('#spendInputDate').val('');
  $('#spendInputSubject').val('');
  $('#spendInputAmount').val('');
});
