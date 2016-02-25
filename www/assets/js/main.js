/*global window,$,moment,Hoodie,sjcl*/
(function () {
  'use strict'
  var hoodie
  var Encryption
  var Budget
  var Transactions
  var dataToBeMoved = []

  // initialize Hoodie
  hoodie = new Hoodie()
  hoodie.setMaxListeners(20)

  // helper function to escape HTML
  function escapeHtml (string) {
    var entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    }
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s]
    })
  }

  // helper function to show the message modal
  function messageModal (strTitle, strContent, strButton) {
    $('#messageModalLabel').html(strTitle)
    $('#messageModalContent').html(strContent)
    $('#messageModalButton').html(strButton)
    $('#messageModal').modal('show')
  }
  $('#messageModalButton').click(function () {
    $('#messageModal').modal('hide')
  })
  function showHoodieError (message) {
    messageModal('Bitte entschuldige',
    'Leider hat das gerade nicht funktioniert. Versuche es bitte noch einmal. Falls dieses Problem wieder auftritt, lade bitte die Seite neu.' +
    'Wenn das nicht hilft, wende dich bitte an <a href="mailto:team@zehntel.org">team@zehntel.org</a>. Bitte verzeihe uns die Unannehmlichkeiten.' +
    '<br><br>Das System meldet: <i>' + message + '</i>',
    'OK')
  }

  // helper function to show the dialog modal
  function dialogModal (strTitle, strContent, strButtonOk, strButtonCancel, onOk, onCancel, isOkGreen) {
    $('#dialogModalLabel').html(strTitle)
    $('#dialogModalContent').html(strContent)
    $('#dialogModalButtonOk').html(strButtonOk)
    $('#dialogModalButtonCancel').html(strButtonCancel)

    if (isOkGreen) {
      $('#dialogModalButtonOk').removeClass('btn-danger')
      $('#dialogModalButtonOk').addClass('btn-success')
      $('#dialogModalButtonCancel').addClass('btn-danger')
      $('#dialogModalButtonCancel').removeClass('btn-success')
    } else {
      $('#dialogModalButtonOk').addClass('btn-danger')
      $('#dialogModalButtonOk').removeClass('btn-success')
      $('#dialogModalButtonCancel').removeClass('btn-danger')
      $('#dialogModalButtonCancel').addClass('btn-success')
    }

    $('#dialogModal').modal('show')

    $('#dialogModalButtonOk').off('click')
    $('#dialogModalButtonOk').click(function () {
      $('#dialogModal').modal('hide')
      onOk()
    })
    $('#dialogModalButtonCancel').off('click')
    $('#dialogModalButtonCancel').click(function () {
      $('#dialogModal').modal('hide')
      onCancel()
    })
  }

  // ENCRYPTION
  Encryption = (function () {
    var usernameSha1
    var salt
    var masterkey
    var encryptionkey

    // internal state variables
    var initialized = false
    var saltStored = false
    var enckeyStored = false

    // encryption settings
    var Hmac = sjcl.misc.hmac
    var Aes = sjcl.cipher.aes
    var keySize = 256
    var adataSize = 32
    var pbkdfIterations = 2048

    return {
      reset: function () {
        usernameSha1 = undefined
        salt = undefined
        masterkey = undefined
        encryptionkey = undefined
        initialized = false
        saltStored = false
        enckeyStored = false
        console.log('Encryption reset')
      },

      isInitialized: function () {
        return !!initialized
      },

      isEncryptionReady: function () {
        return saltStored && enckeyStored && encryptionkey
      },

      // Initializes the Encryption object with Salt
      // Returns a Promise.
      init: function (username) {
        if (initialized) {
          this.reset()
        }
        // Fetch Salt or init it randomly
        usernameSha1 = sjcl.codec.hex.fromBits(sjcl.hash.sha1.hash(username))
        console.log('Encryption init. usernameSha1=' + usernameSha1)
        return hoodie.global.find('global-salts', usernameSha1)
        .then(function (result) {
          salt = result.salt
          initialized = true
          saltStored = true
          console.log('Fetched from global salts: Salt=' + salt)
        })
        .catch(function (error) {
          if (error.name === 'HoodieNotFoundError') {
            salt = sjcl.codec.hex.fromBits(sjcl.random.randomWords(keySize / 32))
            initialized = true
            saltStored = false
            console.log('Created new: Salt=' + salt)
          } else {
            throw error
          }
        })
      },

      // Publishes Salt into the global-salts store.
      // The user needs to be already signed in in order to do so.
      // Returns a Promise.
      publishSalt: function () {
        if (!initialized || !salt) {
          throw new Error('Need to initialize the Encryption object first.')
        }
        if (hoodie.account.username === undefined) {
          throw new Error('Need to sign in to Hoodie first.')
        }

        if (saltStored) {
          return hoodie.global.find('global-salts', usernameSha1)
        }
        console.log('Publish to global salts: Salt=' + salt)
        return hoodie.store.add('global-salts', {
          $public: true,
          id: usernameSha1,
          salt: salt
        })
        .then(function () {
          saltStored = true
        })
        .fail(function (error) {
          throw error
        })
      },

      // Authenticates with plain text password
      // Returns the HMAC for authentication at the server
      authWithPassword: function (password) {
        var hmacSHA1
        var key

        if (!initialized || !salt) {
          throw new Error('Need to initialize the Encryption object first.')
        }
        if (!password) {
          throw new Error('A password is necessary.')
        }

        hmacSHA1 = function (key) {
          var hasher = new Hmac(key, sjcl.hash.sha1)
          this.encrypt = function () {
            return hasher.encrypt.apply(hasher, arguments)
          }
        }

        // perform PBKDF to derive Master Key
        key = sjcl.codec.hex.fromBits(
          sjcl.misc.pbkdf2(
            password,
            sjcl.codec.hex.toBits(salt),
            pbkdfIterations,
            keySize,
            hmacSHA1
          )
        )
        console.log('authWithPassword: derived master key: ' + key)
        return this.authWithMasterKey(key)
      },

      // Authenticates with master key
      // Returns the HMAC for authentication at the server
      authWithMasterKey: function (key) {
        var hmac
        // Store master key internally
        masterkey = key
        // Generate HMAC
        hmac = sjcl.codec.hex.fromBits((new Hmac(
          sjcl.codec.hex.toBits(key),
          sjcl.hash.sha256
        ).mac(salt)))
        console.log('authWithMasterKey: derived HMAC: ' + hmac)
        return hmac
      },

      // Changes the username or password or both.
      // Requires the user to be signed in.
      // Returns a promise.
      changeUsernameOrPassword: function (passwordOld, usernameNew, passwordNew) {
        if (!initialized) {
          throw new Error('Need to initialize encryption prior to change username or password.')
        }
        if (!saltStored) {
          throw new Error('Need to store salt prior to change username or password.')
        }
        if (!enckeyStored) {
          throw new Error('Need to store encryption key prior to change username or password.')
        }
        if (!encryptionkey) {
          throw new Error('Encryption key is empty. Cannot change username or password.')
        }

        // Backup current encryption state
        var usernameSha1Backup = usernameSha1
        var saltBackup = salt
        var masterkeyBackup = masterkey
        var encryptionkeyBackup = encryptionkey
        var restoreEncryptionBackup = function () {
          initialized = true
          saltStored = true
          enckeyStored = true
          usernameSha1 = usernameSha1Backup
          salt = saltBackup
          masterkey = masterkeyBackup
          encryptionkey = encryptionkeyBackup
        }
        var hmacOld = Encryption.authWithPassword(passwordOld)

        // 1. Init new salt
        return Encryption.init(usernameNew)
        .then(function () {
          // 2. Publish salt
          Encryption.publishSalt()
          .then(function () {
            // 3. Generate new HMAC and master key
            var hmacNew = Encryption.authWithPassword(passwordNew)
            // 4. Change password
            hoodie.account.changePassword(hmacOld, hmacNew)
            .then(function () {
              var reencryptEncryptionkey = function () {
                // TODO Enable encryption with the encryptionkeyBackup (hoodie.store.update('encryption-meta', 'current'))
              }
              // 5. Change username (only if changed)
              if (usernameNew !== hoodie.account.username) {
                hoodie.account.changeUsername(hmacOld, usernameNew)
                .then(function () {
                  reencryptEncryptionkey()
                })
                .catch(function (error) {
                  restoreEncryptionBackup()
                  throw error
                })
              } else {
                reencryptEncryptionkey()
              }
            })
            .catch(function (error) {
              restoreEncryptionBackup()
              throw error
            })
          })
          .catch(function (error) {
            restoreEncryptionBackup()
            throw error
          })
        })
        .catch(function (error) {
          restoreEncryptionBackup()
          throw error
        })
      },

      // Prepares encryption by initializing the encryption key.
      // Returns a Promise.
      enableEncryption: function () {
        var prp
        var iv
        var adata
        var enckeybits // encryption key as bit array
        var enckeyenc // encryption key encrypted

        if (!initialized) {
          throw new Error('Need to initialize the Encryption object first.')
        }
        if (!masterkey) {
          throw new Error('Need to authWithPassword or authWithMasterKey first.')
        }
        if (hoodie.account.username === undefined) {
          throw new Error('Need to sign in to Hoodie first.')
        }

        // Fetch encrypted Encryption Key from user store
        return hoodie.store.find('encryption-meta', 'current')
        .then(function (result) {
          console.log('Found current encryption-meta item:')
          console.log(result)
          // Unencrypt Encryption Key
          prp = new Aes(sjcl.codec.hex.toBits(masterkey))
          encryptionkey = sjcl.codec.hex.fromBits(sjcl.mode.gcm.decrypt(
            prp,
            sjcl.codec.hex.toBits(result.enckeyenc),
            sjcl.codec.hex.toBits(result.iv),
            sjcl.codec.hex.toBits(result.adata)
          ))
          console.log('Decrypted encryption key: ' + encryptionkey)
          enckeyStored = true
          hoodie.trigger('encryptionReady')
        })
        .catch(function (error) {
          if (error.name === 'HoodieNotFoundError') {
            // Init new Encryption Key
            prp = new Aes(sjcl.codec.hex.toBits(masterkey))
            enckeybits = sjcl.random.randomWords(keySize / 32)
            iv = sjcl.random.randomWords(keySize / 32)
            adata = sjcl.random.randomWords(adataSize / 32)
            enckeyenc = sjcl.mode.gcm.encrypt(prp, enckeybits, iv, adata)
            // Store encryption key internally
            encryptionkey = sjcl.codec.hex.fromBits(enckeybits)
            console.log('Init new Encryption Key:' +
              ' enckey: ' + encryptionkey +
              ' iv: ' + sjcl.codec.hex.fromBits(iv) +
              ' adata: ' + sjcl.codec.hex.fromBits(adata) +
              ' enckeyenc: ' + sjcl.codec.hex.fromBits(enckeyenc)
            )

            // Persist the encypted encryption key into user store
            hoodie.store.add('encryption-meta', {
              id: 'current',
              iv: sjcl.codec.hex.fromBits(iv),
              adata: sjcl.codec.hex.fromBits(adata),
              enckeyenc: sjcl.codec.hex.fromBits(enckeyenc)
            })
            .then(function () {
              enckeyStored = true
              hoodie.trigger('encryptionReady')
              console.log('Stored enckey: ' + enckeyStored)
            })
            .fail(function (error) {
              throw error
            })
          } else {
            throw error
          }
        })
      },

      // Encrypts all properties of the item (except the id property!).
      // Returns the encrypted item which can then be savely stored in hoodie.store.
      encrypt: function (item) {
        var prp
        var iv
        var adata
        var encrypted

        // Check if saltStored and enckeyStored prior to encrypt anything
        if (!saltStored) {
          throw new Error('Need to store salt prior to encrypt anything.')
        }
        if (!enckeyStored) {
          throw new Error('Need to store encryption key prior to encrypt anything.')
        }
        if (!encryptionkey) {
          throw new Error('Encryption key is empty.')
        }

        // Create new encrypted item
        prp = new Aes(sjcl.codec.hex.toBits(encryptionkey))
        iv = sjcl.random.randomWords(keySize / 32)
        adata = sjcl.random.randomWords(adataSize / 32)
        encrypted = {
          iv: sjcl.codec.hex.fromBits(iv),
          adata: sjcl.codec.hex.fromBits(adata),
          encryptedProperties: []
        }

        // Encrypt all properties (except id)
        for (var property in item) {
          if (item.hasOwnProperty(property)) {
            if (property === 'id') {
              encrypted.id = item.id
              continue
            }
            encrypted[property] = sjcl.codec.hex.fromBits(
              sjcl.mode.gcm.encrypt(
                prp,
                sjcl.codec.utf8String.toBits(item[property]),
                iv,
                adata
              )
            )
            encrypted.encryptedProperties.push(property)
          }
        }
        return encrypted
      },

      // Encrypts an item (if signed in) or marks the item to be encrypted
      // as soon as the user signes in.
      // Returns the (potentially unencrypted!) item.
      encryptIfSignedIn: function (item) {
        if (saltStored || enckeyStored) {
          return this.encrypt(item)
        } else {
          item.preSignIn = true
          return item
        }
      },

      // Decrypts the item and returns the decrypted item.
      decrypt: function (item) {
        var prp
        var iv
        var adata
        var decrypted

        // Check if saltStored and enckeyStored prior to decrypt anything
        if (!saltStored) {
          throw new Error('Need to store salt prior to decrypt anything.')
        }
        if (!enckeyStored) {
          throw new Error('Need to store encryption key prior to decrypt anything.')
        }
        if (!item.encryptedProperties) {
          console.warn('Trying do decrypt an item which is not encrypted:')
          console.warn(item)
        }

        // Create new decrypted item
        prp = new Aes(sjcl.codec.hex.toBits(encryptionkey))
        iv = item.iv
        adata = item.adata
        decrypted = {}

        // Decrypt all encrypted properties
        for (var property in item) {
          if (item.hasOwnProperty(property)) {
            if (property === 'adata' || property === 'encryptedProperties' || property === 'iv') {
              continue
            }
            if (item.encryptedProperties && item.encryptedProperties.indexOf(property) !== -1) {
              decrypted[property] = sjcl.codec.utf8String.fromBits(
                sjcl.mode.gcm.decrypt(
                  prp,
                  sjcl.codec.hex.toBits(item[property]),
                  sjcl.codec.hex.toBits(iv),
                  sjcl.codec.hex.toBits(adata)
                )
              )
            } else {
              decrypted[property] = item[property]
            }
          }
        }
        return decrypted
      },

      // Returns the decrypted item if the user is signed in.
      // Returns unencrypted items as they are.
      // Returns undefined if an encrypted item can not (yet) be encrypted.
      decryptIfSignedIn: function (item) {
        // Just return the item if it's not encrypted
        if (!item.encryptedProperties) {
          return item
        } else if (!saltStored || !enckeyStored) {
          return undefined
        } else return this.decrypt(item)
      }
    }
  })()

  // TRANSACTIONS ---------------------------------
  // Generic object for Transactions
  Transactions = function ($element) {
    var collection = []
    var $el = $element
    var sum = 0.0

    function getTransactionItemIndexById (id) {
      var i
      for (i = 0; i < collection.length; i += 1) {
        if (collection[i].id === id) {
          return i
        }
      }
      return null
    }

    function paint () {
      var i
      var curamountid
      var curamount
      var roundedsum
      var sum = 0.0

      $el.html('')
      collection.sort(function (a, b) {
        return (a.date > b.date) ? 1 : -1
      })
      for (i = 0; i < collection.length; i += 1) {
        curamountid = $el.attr('id') + '-amount-' + collection[i].id
        $el.append(
          '<tr data-id="' + collection[i].id + '">' +
          '<td class="transaction-date">' + escapeHtml(moment(new Date(collection[i].date)).format('DD.MM.YYYY')) + '</td>' +
          '<td class="transaction-subject">' + escapeHtml(collection[i].subject) + '</td>' +
          '<td class="transaction-amount autonumeric" id="' + curamountid + '">' + escapeHtml(collection[i].amount) + '</td>' +
          '<td class="transaction-dropdown">' +
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
        )
        try {
          $('#' + curamountid).autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})

          // get amount as number to compute sum
          curamount = $('#' + curamountid).autoNumeric('get')
          sum += parseFloat(curamount)
        } catch (ignore) {
          // collection[i].amount is not numeric
        }
      }

      // register event handler to edit and delete items
      $('.do-edit-transaction').off('click')
      $('.do-edit-transaction').click(function (event) {
        event.preventDefault()
        var toeditid = $(event.target).attr('data-edit')
        var toedittype = $(event.target).attr('data-type')
        var toeditdate = $('tr[data-id=' + toeditid + '] .transaction-date').text()
        var toeditsubject = $('tr[data-id=' + toeditid + '] .transaction-subject').text()
        var toeditamount = $('tr[data-id=' + toeditid + '] .transaction-amount').text()

        // create inputs to edit item
        $('tr[data-id=' + toeditid + '] .transaction-date').html('')
        $('tr[data-id=' + toeditid + '] .transaction-date').append(
          '<input type="text" class="form-control input-sm onLogoffClearVal" class="edit-input-date" data-transaction="' + toeditid + '" value="' + toeditdate + '">'
        )
        $('tr[data-id=' + toeditid + '] .transaction-subject').html('')
        $('tr[data-id=' + toeditid + '] .transaction-subject').append(
          '<input type="text" class="form-control input-sm onLogoffClearVal" class="edit-input-subject" data-transaction="' + toeditid + '" value="' + toeditsubject + '">'
        )
        $('tr[data-id=' + toeditid + '] .transaction-amount').html('')
        $('tr[data-id=' + toeditid + '] .transaction-amount').append(
          '<input type="text" class="form-control input-sm onLogoffClearVal autonumeric" class="edit-input-amount" data-transaction="' + toeditid + '">'
        )
        $('tr[data-id=' + toeditid + '] .transaction-amount input').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})
        $('tr[data-id=' + toeditid + '] .transaction-amount input').autoNumeric('set', escapeHtml(toeditamount.replace(' €', '').replace(',', '.')))
        $('tr[data-id=' + toeditid + '] .transaction-dropdown').html('')
        $('tr[data-id=' + toeditid + '] .transaction-dropdown').append(
          '<button type="submit" class="btn btn-success btn-sm do-confirm-edit-transaction" data-transaction="' + toeditid + '">OK</button>'
        )

        // event handler to save changes
        $('tr[data-id=' + toeditid + '] .do-confirm-edit-transaction').off('click')
        $('tr[data-id=' + toeditid + '] .do-confirm-edit-transaction').click(function (event) {
          event.preventDefault()
          var tosaveid = $(event.target).attr('data-transaction')
          var rawDate = $('tr[data-id=' + toeditid + '] .transaction-date input').val()
          var rawSubject = $('tr[data-id=' + toeditid + '] .transaction-subject input').val()
          var valDate
          var strDate
          var strAmount
          var strSubject

          // 1. validate date
          valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'D.M.YYYY', 'D.M.YY', 'MM/DD/YYYY', 'YYYY/MM/DD'], true)
          if (!valDate.isValid()) {
            messageModal('Hoppla',
              'Bitte gib das Datum im Format TT.MM.JJJJ an, z.B. ' + moment().format('DD.MM.YYYY') + '. Vielen Dank!',
              'OK')
            return
          }
          strDate = valDate.toDate().toISOString()

          // 2. get subject
          strSubject = rawSubject

          // 3. get amount
          strAmount = $('tr[data-id=' + toeditid + '] .transaction-amount input').autoNumeric('get')
          if (!strAmount) {
            strAmount = 0.0
          }

          hoodie.store.update(toedittype, tosaveid, Encryption.encryptIfSignedIn({
            date: strDate,
            subject: strSubject,
            amount: strAmount,
            updated: moment().toDate()
          })).fail(function (error) {
            showHoodieError(error.message)
          })
        })
      })
      $('.do-delete-transaction').off('click')
      $('.do-delete-transaction').click(function (event) {
        event.preventDefault()
        var todeleteid = $(event.target).attr('data-delete')
        var todeletetype = $(event.target).attr('data-type')

        // show confirmation dialog in advance
        dialogModal('Wirklich löschen?',
          'Wenn ich den Eintrag für dich lösche, kann das nicht rückgängig gemacht werden. Bist du sicher, dass du den Eintrag <b>' +
          $('tr[data-id=' + todeleteid + '] .transaction-subject').html() +
          '</b> löschen möchtest?',
          'Löschen',
          'Behalten',
          function () {
            hoodie.store.remove(todeletetype, todeleteid)
            .fail(function (error) {
              showHoodieError(error.message)
            })
          },
          function () { $('tr[data-id=' + todeleteid + '] .transaction-dropdown .dropdown-menu').dropdown('toggle') },
          false)
      })

      // add final sum row to table
      $el.append(
        '<tr>' +
        '<td></td>' +
        '<td><b>Dein Budget:</b></td>' +
        '<td style="font-weight: bold;" class="autonumeric" id="' + $el.attr('id') + '-sum-row' + '"><b>' + sum + '</b></td>' +
        '<td></td>' +
        '</tr>'
      )
      $('#' + $el.attr('id') + '-sum-row').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})

      // update sum display
      roundedsum = Math.round(sum)
      $('.' + $el.attr('id') + '-sum').html(roundedsum + ' €')
      if (roundedsum <= 0) {
        $('.' + $el.attr('id') + '-sum').addClass('negative-sum')
      } else {
        $('.' + $el.attr('id') + '-sum').removeClass('negative-sum')
      }
    }

    this.add = function (transaction, doRepaint) {
      if (!Encryption.isEncryptionReady()) {
        $('#signupSuggestion').removeClass('hidden')
      }
      collection.push(transaction)
      if (doRepaint) {
        paint()
      }
    }

    this.update = function (transaction) {
      var txindex = getTransactionItemIndexById(transaction.id)
      if (txindex === null) {
        // add to collection if this transaction does not exist yet
        collection.push(transaction)
      } else {
        // just update the transaction
        collection[txindex] = transaction
      }
      paint()
    }

    this.remove = function (transaction) {
      collection.splice(getTransactionItemIndexById(transaction.id), 1)
      paint()
    }

    this.clear = function () {
      collection = []
      paint()
    }

    this.getSum = function () {
      return sum
    }

    this.repaint = function () {
      paint()
    }
  }

  // BUDGET ------------------------------------------
  // Generic object for a Zehntel Budget
  Budget = function (basename) {
    var transactions = new Transactions($('#' + basename + '-transactions'))
    var memo

    // helper function to toggle onEmpty classes
    var addTransaction = function (transaction, doRepaint) {
      $('#' + basename + '-panel .onEmptyShow').addClass('hidden')
      $('#' + basename + '-panel .onEmptyHide').removeClass('hidden')
      $('#' + basename + '-tab .onEmptyShow').addClass('hidden')
      $('#' + basename + '-tab .onEmptyHide').removeClass('hidden')
      transactions.add(transaction, doRepaint)
    }

    // helper function to load all transactions from the store
    var loadTransactions = function () {
      hoodie.store.findAll(basename + 'item').then(function (items) {
        items.forEach(function (transaction) {
          var decrypted = Encryption.decryptIfSignedIn(transaction)
          if (decrypted) {
            addTransaction(decrypted, false)
          }
        })
        if (items.length) {
          transactions.repaint()
        }
      }).fail(function (error) {
        showHoodieError(error.message)
      })
    }

    // initial load of all transactions from the store
    loadTransactions()

    // when a transaction changes, update the UI
    hoodie.store.on(basename + 'item:add', function (transaction) {
      var decrypted = Encryption.decryptIfSignedIn(transaction)
      if (decrypted) {
        addTransaction(decrypted, true)
      }
    })
    hoodie.store.on(basename + 'item:update', function (transaction) {
      var decrypted = Encryption.decryptIfSignedIn(transaction)
      if (decrypted) {
        transactions.update(decrypted)
      }
    })
    hoodie.store.on(basename + 'item:remove', function (transaction) {
      var decrypted = Encryption.decryptIfSignedIn(transaction)
      if (decrypted) {
        transactions.remove(decrypted)
      }
    })
    // clear items when user logs out
    hoodie.account.on('signup signin signout', transactions.clear)
    // show encrypted transactions as soon as decryption is ready
    hoodie.on('encryptionReady', function () {
      loadTransactions()
    })

    // when memo changes, update the UI
    var updateMemo = function (item) {
      $('#' + basename + '-memo-change').addClass('hidden')
      $('#' + basename + '-memo-show-amount').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})
      $('#' + basename + '-memo-show-amount').autoNumeric('set', escapeHtml(item.amount))
      $('#' + basename + '-memo').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})
      $('#' + basename + '-memo').autoNumeric('set', escapeHtml(item.amount))
      $('#' + basename + '-memo-show').removeClass('hidden')
    }

    // load the "memo to myself"
    var loadMemo = function () {
      hoodie.store.find(basename + 'memo', basename + 'memo').done(function (item) {
        memo = Encryption.decryptIfSignedIn(item)
        if (memo) {
          updateMemo(memo)
        }
      })
    }
    loadMemo()

    // update the memo if changed
    hoodie.store.on(basename + 'memo:add ' + basename + 'memo:update', function (item) {
      var decrypted = Encryption.decryptIfSignedIn(item)
      if (decrypted) {
        updateMemo(decrypted)
      }
    })
    hoodie.on('encryptionReady', function () {
      loadMemo()
    })

    // handle click on change memo link
    $('#' + basename + '-memo-changeit').on('click', function (event) {
      event.preventDefault()
      $('#' + basename + '-memo-change').removeClass('hidden')
      $('#' + basename + '-memo-show').addClass('hidden')
    })

    // on submit
    $('#' + basename + '-panel').on('submit', function (event) {
      event.preventDefault()

      // fetch form data
      var inputMemo = $('#' + basename + '-memo')
      var inputDate = $('#' + basename + '-input-date')
      var inputSubject = $('#' + basename + '-input-subject')
      var inputAmount = $('#' + basename + '-input-amount')
      var rawDate = inputDate.val()
      var rawSubject = inputSubject.val()
      var rawAmount = inputAmount.val()
      var strMemo = inputMemo.autoNumeric('get')
      var valDate
      var strDate
      var strSubject
      var strAmount

      // save the "memo to myself"
      if (!$('#' + basename + '-memo-change').hasClass('hidden') && strMemo > 0) {
        hoodie.store.updateOrAdd(basename + 'memo', basename + 'memo', Encryption.encryptIfSignedIn({
          amount: strMemo,
          updated: moment().toDate()
        }))
        .fail(function (error) {
          showHoodieError(error.message)
        })
        $('#' + basename + '-memo-change').addClass('hidden')
        $('#' + basename + '-memo-show').removeClass('hidden')
      }

      // create a new item
      if (rawDate || rawSubject || rawAmount) {
        // 1. validate date
        valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'D.M.YYYY', 'D.M.YY', 'MM/DD/YYYY', 'YYYY/MM/DD'], true)
        if (!valDate.isValid()) {
          messageModal('Hoppla',
            'Bitte gib das Datum im Format TT.MM.JJJJ an, z.B. ' + moment().format('DD.MM.YYYY') + '. Vielen Dank!',
            'OK')
          return
        }
        strDate = valDate.toDate().toISOString()

        // 2. get subject
        strSubject = rawSubject

        // 3. get amount
        strAmount = inputAmount.autoNumeric('get')
        if (!strAmount) {
          return
        }
        // make it a negative value
        if (strAmount > 0) {
          strAmount *= -1
        }

        // persist new item
        hoodie.store.add(basename + 'item', Encryption.encryptIfSignedIn({
          date: strDate,
          subject: strSubject,
          amount: strAmount
        }))
        .fail(function (error) {
          showHoodieError(error.message)
        })
        inputDate.val(moment().format('DD.MM.YYYY'))
        inputSubject.val('')
        inputAmount.val('')
      }
    })
  }

  // ACCOUNT FUNCTIONALITY (LOGIN/LOGOUT) -----------------------------------
  function setLoggedIn (state) {
    if (state) {
      // set page layout to logged in state
      $('.onLoginClearVal').val('')
      $('.onLoginHide').addClass('hidden')
      $('.onLoginShow').removeClass('hidden')

      // hide login dialog and show user name
      $('#loginModal').modal('hide')
      $('.hoodieUsername').html(hoodie.account.username)

      // load settings
      $('#settingsName').val(hoodie.account.username)
      hoodie.store.find('userinfo', 'useremail').done(function (item) {
        $('#settingsEmail').val(item.email)
      })
    } else {
      // reset Encryption
      Encryption.reset()

      // set page layout to logged out state
      $('.onLogoffShow').removeClass('hidden')
      $('.onLogoffHide').addClass('hidden')
      $('.onEmptyShow').removeClass('hidden')
      $('.onEmptyHide').addClass('hidden')

      // important: clear everything in the DOM from the previously logged in user
      $('.onLogoffClearContent').html('')
      $('.onLogoffClearVal').val('')

      // insert today's date as default
      $('.insertToday').val(moment().format('DD.MM.YYYY'))
    }
  }

  // LOGIN FORM SUBMIT
  $('#loginForm').submit(function (event) {
    event.preventDefault()
    var username = $('#loginName').val()
    var password = $('#loginPassword').val() // should never be sent
    var passwordRepeat = $('#loginPasswordRepeat').val() // should never be sent
    var email = $('#loginEmail').val()
    var signInOrUp = function (moveData) {
      var hmac

      // Initialize Encryption (salt) if not done yet
      if (!Encryption.isInitialized()) {
        Encryption.init(username)
        .then(function () {
          signInOrUp(moveData)
        })
        .fail(function (error) {
          showHoodieError(error.message)
        })
        return
      }

      // Remove all items that have been entered prior to sign in and are thus still unencrypted
      hoodie.store.removeAll(function (item) {
        return item.preSignIn
      })
      .done(function (preSignInItems) {
        // Move data if the user decided to keep it
        if (moveData) {
          preSignInItems.forEach(function (preSignInItem) {
            var toBeMovedItem = {}
            for (var property in preSignInItem) {
              if (preSignInItem.hasOwnProperty(property)) {
                if (
                  property === 'preSignIn' ||
                  /^_/.test(property) ||
                  property === 'createdAt' ||
                  property === 'createdBy' ||
                  property === 'id' ||
                  property === 'updatedAt'
                ) {
                  continue
                } else {
                  toBeMovedItem[property] = preSignInItem[property]
                }
              }
            }
            dataToBeMoved.push(toBeMovedItem)
          })

          // encrypt and add items as soon as encryption is ready
          hoodie.one('encryptionReady', function () {
            dataToBeMoved.forEach(function (item) {
              var itemType = item.type
              delete item.type
              hoodie.store.add(itemType, Encryption.encrypt(item))
              .fail(function (error) {
                showHoodieError(error)
              })
            })
            dataToBeMoved = []
          })
        }

        // Now sign up or sign in
        if ($('input[type=radio][name=loginSignupOption]:checked').val() === 'signup') {
          // sign up as a new user

          if (!username || !password) {
            $('#signupFailed').removeClass('hidden')
            $('#signupFailed').html('Bitte gib einen Namen (kann auch ein Fantasiename sein) und ein Passwort ein.')
            return
          }

          if (password !== passwordRepeat) {
            $('#signupFailed').removeClass('hidden')
            $('#signupFailed').html('Das Passwort und die Passwortbestätigung stimmen nicht überein. Bitte stelle sicher, dass du dich nicht vertippt hast.')
            return
          }

          // Sign out first if signed in
          if (hoodie.account.username) {
            hoodie.account.signOut({ignoreLocalChanges: true})
            .done(function () {
              signInOrUp(moveData)
            })
            .fail(function (error) {
              showHoodieError(error)
            })
            return
          }

          // Compute HMAC to authorize (never send the password to Hoodie!)
          hmac = Encryption.authWithPassword(password)
          hoodie.account.signUp(username, hmac)
          .done(
            function () {
              // signup successful
              // publish salt
              Encryption.publishSalt()
              .then(function () {
                // enable encryption
                Encryption.enableEncryption()
                .then(function () {
                  setLoggedIn(true)
                })
              })
              .fail(function (error) {
                showHoodieError(error.message)
                // emergency sign out since salt could not be saved
                hoodie.account.signOut()
                .done(
                  function () {
                    // logout successful
                    setLoggedIn(false)
                  }
                ).fail(
                  function (error) {
                    // logout failed
                    showHoodieError(error.message)
                  }
                )
              })

              // set e-mail
              if (email) {
                hoodie.store.add('userinfo', { id: 'useremail', email: email })
                .fail(
                  function (error) {
                    showHoodieError(error.message)
                  }
                )
              }
            }
          ).fail(
            function (error) {
              // signup failed
              if (error.name === 'HoodieConflictError') {
                $('#signupFailed').removeClass('hidden')
                $('#signupFailed').html('Dieser Name ist bereits bei Zehntel.org registriert. Bitte wähle einen anderen Namen.')
                return
              }
              $('#loginFailedDetail').html(error.message)
              $('#loginFailed').removeClass('hidden')
              setLoggedIn(false)
            }
          )
        } else {
          // sign in using existing credentials
          hmac = Encryption.authWithPassword(password)
          hoodie.account.signIn(username, hmac)
          .done(
            function () {
              // login successful, enable encryption
              Encryption.enableEncryption()
              .then(function () {
                setLoggedIn(true)
              })
            }
          )
          .fail(
            function (error) {
              // login failed
              $('#loginFailedDetail').html(error.message)
              $('#loginFailed').removeClass('hidden')
              setLoggedIn(false)
            }
          )
        }
      })
      .fail(function (error) {
        showHoodieError(error)
      })
    }

    // hide previous errors
    $('#signupFailed, #loginFailed').addClass('hidden')

    // ask whether anonymously entered data should be kept
    if (!$('#signupSuggestion').hasClass('hidden')) {
      dialogModal('Daten behalten?',
        'Du hast gerade eben vor deiner Anmeldung Daten in Zehntel.org eingetragen. Möchtest du diese Einträge in deinen Account übernehmen?',
        'Daten übernehmen',
        'Daten verwerfen',
        function () { signInOrUp(true) },
        function () { signInOrUp(false) },
        true)
    } else {
      signInOrUp(false)
    }
  })

  $('#logoutButton').click(function () {
    hoodie.account.signOut()
    .done(
      function () {
        // logout successful
        setLoggedIn(false)
      }
    ).fail(
      function (error) {
        // logout failed
        showHoodieError(error.message)
      }
    )
  })

  hoodie.account.on('error:unauthenticated signout', function () {
    setLoggedIn(false)
  })

  /* TODO Check if we need this - enableEncryption in that case
  hoodie.account.on('signin signup', function () {
    setLoggedIn(true)
  })*/

  $('#loginModal').on('hidden.bs.modal', function () {
    // empty password fields on modal close
    $('#loginModal input[type=password]').val('')
  })

  // SETTINGS -------------------------------------
  $('#settingsForm').submit(function (event) {
    event.preventDefault()
    var username = $('#settingsName').val()
    var passwordOld = $('#settingsOldPassword').val()
    var passwordNew = $('#settingsNewPassword').val()
    var passwordNewRepeat = $('#settingsNewPasswordRepeat').val()
    var email = $('#settingsEmail').val()
    var closeCounter = 3

    $('#settingsFailed').addClass('hidden')

    // change username if requested
    if (username !== hoodie.account.username) {
      if (!passwordOld) {
        $('#settingsFailed').removeClass('hidden')
        $('#settingsFailed').html('Bitte gib dein aktuelles Passwort ein, um deinen Namen zu ändern.')
        return
      }
      hoodie.account.changeUsername(passwordOld, username)
      .done(function () {
        closeCounter -= 1
        if (!closeCounter) {
          $('#settingsModal').modal('hide')
        }
      })
      .fail(function (error) {
        if (error.name === 'HoodieConflictError') {
          $('#settingsFailed').removeClass('hidden')
          $('#settingsFailed').html('Dieser Name ist bereits bei Zehntel.org registriert. Bitte wähle einen anderen Namen.')
          return
        }
        if (error.name === 'HoodieUnauthorizedError') {
          $('#settingsFailed').removeClass('hidden')
          $('#settingsFailed').html('Dein aktuelles Passwort ist nicht korrekt eingegeben.')
          return
        }
        $('#settingsFailed').html(error.message)
        $('#settingsFailed').removeClass('hidden')
      })
    } else {
      closeCounter -= 1
    }

    // change password if requested
    if (passwordNew || passwordNewRepeat) {
      if (!passwordOld) {
        $('#settingsFailed').removeClass('hidden')
        $('#settingsFailed').html('Bitte gib dein aktuelles Passwort ein, um dein Passwort zu ändern.')
        return
      }
      if (passwordNew !== passwordNewRepeat) {
        $('#settingsFailed').removeClass('hidden')
        $('#settingsFailed').html('Das neue Passwort und die Wiederholung des neuen Passworts stimmen nicht überein.')
        return
      }
      if (passwordOld !== passwordNew) {
        hoodie.account.changePassword(passwordOld, passwordNew)
        .done(function () {
          closeCounter -= 1
          if (!closeCounter) {
            $('#settingsModal').modal('hide')
          }
        })
        .fail(function (error) {
          if (error.name === 'HoodieUnauthorizedError') {
            $('#settingsFailed').removeClass('hidden')
            $('#settingsFailed').html('Dein aktuelles Passwort ist nicht korrekt eingegeben.')
            return
          }
          $('#settingsFailed').html(error.message)
          $('#settingsFailed').removeClass('hidden')
        })
      } else {
        closeCounter -= 1
      }
    } else {
      closeCounter -= 1
    }

    // change e-mail address
    hoodie.store.updateOrAdd('userinfo', 'useremail', {'email': email})
    .done(function () {
      closeCounter -= 1
      if (!closeCounter) {
        $('#settingsModal').modal('hide')
      }
    })
    .fail(function (error) {
      $('#settingsFailed').html(error.message)
      $('#settingsFailed').removeClass('hidden')
    })
  })
  $('#settingsModal').on('hidden.bs.modal', function () {
    // empty password fields on modal close
    $('#settingsModal input[type=password]').val('')
  })
  hoodie.store.on('userinfo:add userinfo:update', function (item) {
    if (item.id === 'useremail') {
      $('#settingsEmail').val(item.email)
    }
  })
  hoodie.account.on('changeusername', function (newUsername) {
    $('.hoodieUsername').html(newUsername)
    $('#settingsName').val(newUsername)
  })

  // MAIN FUNCTION --------------------------------
  // execute when DOM is ready
  $(function () {
    var connectionCheck
    var updateIncomeSum
    var budgets

    // handle CTA button
    $('#ctaButton').on('click', function () {
      $('#main-jumbotron').addClass('hidden')
      $('#cta-container').addClass('hidden')
      $('#main-container').removeClass('hidden')
    })

    // enable tooltips
    $('[data-toggle="tooltip"]').tooltip()

    // enable autoNumeric to help entering currency data
    $('.autonumeric').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})

    // insert today's date as default
    $('.insertToday').val(moment().format('DD.MM.YYYY'))

    // initialize the connection checker
    connectionCheck = function () {
      window.setTimeout(function () {
        hoodie.checkConnection()
        .done(function () {
          $('.connectionOffline').addClass('hidden')
        })
        .fail(function () {
          $('.connectionOffline').removeClass('hidden')
        })
        connectionCheck()
      }, 1000)
    }
    connectionCheck()

    // show additional fields when the user wants to signUP
    $('input[type=radio][name=loginSignupOption]').change(function () {
      if (this.value === 'signin') {
        $('.loginSignup').addClass('hidden')
      }
      if (this.value === 'signup') {
        $('.loginSignup').removeClass('hidden')
      }
    })
    if ($('input[type=radio][name=loginSignupOption]:checked').val() === 'signup') {
      $('.loginSignup').removeClass('hidden')
    }

    // INCOME INPUT -----------------------------

    // helper function to update the percentage and the remaining amount of income
    updateIncomeSum = function () {
      var strAmount = $('#income-amount').autoNumeric('get')
      var strSpend = $('#income-spend').autoNumeric('get')
      var strContracts = $('#income-contracts').autoNumeric('get')
      var strSave = $('#income-save').autoNumeric('get')
      var strInvest = $('#income-invest').autoNumeric('get')
      var strGive = $('#income-give').autoNumeric('get')
      var remainingSum
      var givePercentage

      remainingSum = strAmount - strSpend - strContracts - strSave - strInvest - strGive
      $('#income-sum-text').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})
      $('#income-sum-text').autoNumeric('set', escapeHtml(remainingSum))
      if (remainingSum < -0.001) {
        $('#income-sum-text').addClass('negative-sum')
      } else {
        $('#income-sum-text').removeClass('negative-sum')
      }

      givePercentage = (100 * strGive / strAmount).toFixed(0)
      $('#income-give-percentage').html(givePercentage + ' %')
    }

    // on submit of new income open distribution form
    $('#income-new-form').on('submit', function (event) {
      event.preventDefault()
      if (!$('#income-amount').autoNumeric('get')) {
        return
      }

      $('#income-dist-div').removeClass('hidden')

      // check if there is a previous item with the same amount - if so, fill all input forms with the last values
      hoodie.store.findAll(function (object) {
        if (object.type !== 'income') {
          return false
        }
        var decrypted = Encryption.decryptIfSignedIn(object)
        return decrypted && decrypted.amount === $('#income-amount').autoNumeric('get')
      })
      .done(function (sameAmountItems) {
        if (sameAmountItems.length > 0) {
          // fetch the ID of the latest item with this amount
          var lastid = sameAmountItems.sort(function (a, b) {
            return b.createdAt - a.createdAt
          })[0].id

          // set income-spend field
          hoodie.store.findAll(function (object) {
            if ((object.type) !== 'spenditem') {
              return false
            }
            var decrypted = Encryption.decryptIfSignedIn(object)
            return decrypted && decrypted.income === lastid
          })
          .done(function (items) {
            if (items.length > 0) {
              $('#income-spend').autoNumeric('set', escapeHtml(Encryption.decrypt(items[0]).amount))
              updateIncomeSum()
            }
          })

          // set income-contracts field
          hoodie.store.findAll(function (object) {
            if ((object.type) !== 'contractsitem') {
              return false
            }
            var decrypted = Encryption.decryptIfSignedIn(object)
            return decrypted && decrypted.income === lastid
          })
          .done(function (items) {
            if (items.length > 0) {
              $('#income-contracts').autoNumeric('set', escapeHtml(Encryption.decrypt(items[0]).amount))
              updateIncomeSum()
            }
          })

          // set income-save field
          hoodie.store.findAll(function (object) {
            if ((object.type) !== 'saveitem') {
              return false
            }
            var decrypted = Encryption.decryptIfSignedIn(object)
            return decrypted && decrypted.income === lastid
          })
          .done(function (items) {
            if (items.length > 0) {
              $('#income-save').autoNumeric('set', escapeHtml(Encryption.decrypt(items[0]).amount))
              updateIncomeSum()
            }
          })

          // set income-invest field
          hoodie.store.findAll(function (object) {
            if ((object.type) !== 'investitem') {
              return false
            }
            var decrypted = Encryption.decryptIfSignedIn(object)
            return decrypted && decrypted.income === lastid
          })
          .done(function (items) {
            if (items.length > 0) {
              $('#income-invest').autoNumeric('set', escapeHtml(Encryption.decrypt(items[0]).amount))
              updateIncomeSum()
            }
          })

          // set income-give field
          hoodie.store.findAll(function (object) {
            if ((object.type) !== 'giveitem') {
              return false
            }
            var decrypted = Encryption.decryptIfSignedIn(object)
            return decrypted && decrypted.income === lastid
          })
          .done(function (items) {
            if (items.length > 0) {
              $('#income-give').autoNumeric('set', escapeHtml(Encryption.decrypt(items[0]).amount))
              updateIncomeSum()
            }
          })
        } else {
          // calculate 10%
          $('#income-give').autoNumeric('set', $('#income-amount').autoNumeric('get') * 0.1)
          updateIncomeSum()
        }
      })
    })

    // close distribution panel on click on the upper right x
    $('#income-dist-div-close').on('click', function () {
      $('#income-dist-div').addClass('hidden')
    })

    // update income sum if any field gets changed
    $('.onChangeUpdateIncomeSum').change(updateIncomeSum)

    $('#income-dist-form').on('submit', function (event) {
      event.preventDefault()
      updateIncomeSum()

      // fetch income distribution
      var rawDate = $('#income-date').val()
      var valDate
      var strDate
      var strSubject = $('#income-subject').val()
      var strAmount = $('#income-amount').autoNumeric('get')
      var strSpend = $('#income-spend').autoNumeric('get')
      var strContracts = $('#income-contracts').autoNumeric('get')
      var strSave = $('#income-save').autoNumeric('get')
      var strInvest = $('#income-invest').autoNumeric('get')
      var strGive = $('#income-give').autoNumeric('get')
      var incomeId = -1
      var remainingSum = strAmount - strSpend - strContracts - strSave - strInvest - strGive

      valDate = moment(rawDate, ['DD.MM.YY', 'DD.MM.YYYY', 'D.M.YYYY', 'D.M.YY', 'MM/DD/YYYY', 'YYYY/MM/DD'], true)
      if (!valDate.isValid()) {
        messageModal('Hoppla',
          'Bitte gib das Datum im Format TT.MM.JJJJ an, z.B. ' + moment().format('DD.MM.YYYY') + '. Vielen Dank!',
          'OK')
        return
      }
      strDate = valDate.toDate().toISOString()

      // check if sum of distributed income is equal to total income
      if (remainingSum < -0.001) {
        messageModal('Bitte nochmal prüfen',
          'Du hast mehr Geld aufgeteilt, als du eingenommen hast. Bitte korrigiere das.',
          'OK')
        return
      }

      if (remainingSum > 0.001) {
        dialogModal('Da ist noch etwas übrig',
          'Du hast noch <b id="remaining-dialog-amount">' + remainingSum + '</b> übrig, die du verteilen kannst. Möchtest du diesen Betrag zum Zehntel hinzufügen?',
          'Ja zum Zehntel addieren',
          'Nein nochmal nachdenken',
          function () {
            $('#income-give').autoNumeric('set', remainingSum + (strGive > 0.001 ? parseFloat(strGive) : 0))
            updateIncomeSum()
          },
          function () { updateIncomeSum() },
          true)
        $('#remaining-dialog-amount').autoNumeric('init', {aSep: '.', aDec: ',', aSign: ' €', pSign: 's'})
        return
      }

      // add to Hoodie store
      hoodie.store.add('income', Encryption.encryptIfSignedIn({
        date: strDate,
        subject: strSubject,
        amount: strAmount
      }))
      .done(function (income) {
        incomeId = income.id

        if (strSpend > 0) {
          hoodie.store.add('spenditem', Encryption.encryptIfSignedIn({
            date: strDate,
            subject: strSubject,
            amount: strSpend,
            income: incomeId
          }))
          .fail(function (error) {
            showHoodieError(error.message)
          })
        }
        if (strContracts > 0) {
          hoodie.store.add('contractsitem', Encryption.encryptIfSignedIn({
            date: strDate,
            subject: strSubject,
            amount: strContracts,
            income: incomeId
          }))
          .fail(function (error) {
            showHoodieError(error.message)
          })
        }
        if (strSave > 0) {
          hoodie.store.add('saveitem', Encryption.encryptIfSignedIn({
            date: strDate,
            subject: strSubject,
            amount: strSave,
            income: incomeId
          }))
          .fail(function (error) {
            showHoodieError(error.message)
          })
        }
        if (strInvest > 0) {
          hoodie.store.add('investitem', Encryption.encryptIfSignedIn({
            date: strDate,
            subject: strSubject,
            amount: strInvest,
            income: incomeId
          }))
          .fail(function (error) {
            showHoodieError(error.message)
          })
        }
        if (strGive > 0) {
          hoodie.store.add('giveitem', Encryption.encryptIfSignedIn({
            date: strDate,
            subject: strSubject,
            amount: strGive,
            income: incomeId
          }))
          .fail(function (error) {
            showHoodieError(error.message)
          })
        }

        // success! reset input fields
        $('.income-input').val('')
        $('#income-date').val(moment().format('DD.MM.YYYY'))
        $('#income-dist-div').addClass('hidden')

        // show suggestion to signup
        if (!Encryption.isEncryptionReady()) {
          $('#signupSuggestion').removeClass('hidden')
        }
      })
      .fail(function (error) {
        showHoodieError(error.message)
      })
    })

    // create budgets
    budgets = []
    budgets.push(new Budget('spend'))
    budgets.push(new Budget('contracts'))
    budgets.push(new Budget('save'))
    budgets.push(new Budget('invest'))
    budgets.push(new Budget('give'))

    // set initial state to logged off (since we need authentication to decrypt)
    setLoggedIn(false)

    /* TODO check if we need this instead
    if (hoodie.account.username === undefined) {
      setLoggedIn(false)
    } else {
      setLoggedIn(true)
    }*/

    $('.onHoodieReadyHide').addClass('hidden')
    $('.onHoodieReadyShow').removeClass('hidden')
  })
}())
