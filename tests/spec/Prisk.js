describe('when initting prisk', function() {

  describe('when initting the storage', function() {

    const chrome = {
      storage: {
        sync: {
          set: function(items, promiseFunction) {}
        }
      }
    };

    it('sets default storage info if absent', function() {
      // explicitly override get here to pass a Promise.resolve
      // to the passed-in callback function, which jasmine can't
      // easily mimic
      chrome.storage.sync.get = function(key, promiseFunction) {
        promiseFunction({});
      };

      spyOn(chrome.storage.sync, 'get').and.callThrough();
      spyOn(chrome.storage.sync, 'set');

      prisk._initStorage(chrome.storage.sync);

      expect(chrome.storage.sync.get).toHaveBeenCalled();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });

    it ('does not set storage if the value is there', function() {
      chrome.storage.sync.get = function(key, promiseFunction) {
        promiseFunction( {access_info:[]} );
      };

      spyOn(chrome.storage.sync, 'get').and.callThrough();
      spyOn(chrome.storage.sync, 'set');

      prisk._initStorage(chrome.storage.sync);

      expect(chrome.storage.sync.get).toHaveBeenCalled();
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });

  });

});
