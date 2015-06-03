"use strict";

// Generic class for Transactions
function Transactions($element) {
  var collection = [];
  var $el = $element;

  function getTransactionItemIndexById(id) {
    for (var i = 0; i < collection.length; i++) {
      if (collection[i].id === id) {
        return i;
      }
    };
    return null;
  }

  function paint() {
    $el.html('');
    collection.sort(function(a, b) {
      return (a.date > b.date) ? 1 : -1;
    });
    for (var i = 0; i < collection.length; i++) {
      // TODO perform validation here, too
      $el.append(
        '<tr data-id="' + collection[i].id + '">' +
          '<td>' + moment(new Date(collection[i].date)).format('DD.MM.YYYY') + '</td>' +
          '<td>' + collection[i].subject + '</td>' +
          '<td>' + collection[i].amount + '</td>' +
        '</tr>'
      );
    };
  }

  this.add = function(transaction) {
    collection.push(transaction);
    paint();
  };

  this.update = function(transaction) {
    collection[getTransactionItemIndexById(transaction.id)] = transaction;
    paint();
  };

  this.remove = function(transaction) {
    collection.splice(getTransactionItemIndexById(transaction.id), 1);
    paint();
  };

  this.clear = function() {
    collection = [];
    paint();
  };
}
