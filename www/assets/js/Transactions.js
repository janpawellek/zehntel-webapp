"use strict";

// Generic class for Transactions
function Transactions($element) {
  var collection = [];
  var $el = $element;
  var sum = 0.0;

  function getTransactionItemIndexById(id) {
    for (var i = 0; i < collection.length; i++) {
      if (collection[i].id === id) {
        return i;
      }
    };
    return null;
  }

  function paint() {
    sum = 0.0;
    $el.html('');
    collection.sort(function(a, b) {
      return (a.date > b.date) ? 1 : -1;
    });
    for (var i = 0; i < collection.length; i++) {
      var curamountid = $el.attr('id') + '-amount-' + collection[i].id;
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
        var curamount = $('#' + curamountid).autoNumeric('get');
        sum += parseFloat(curamount);
      }
      catch (e) {
        // TODO validation failed, collection[i].amount is not numeric
        console.log('non-numerical amount')
      }
    };

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
    var roundedsum = Math.round(sum);
    $('.' + $el.attr('id') + '-sum').html(roundedsum + ' €');
    if (roundedsum <= 0) {
      $('.' + $el.attr('id') + '-sum').addClass('negative-sum');
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

  this.getSum = function() {
    return sum;
  }
}
