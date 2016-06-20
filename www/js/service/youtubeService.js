(function(){
    angular.module('youtubeSearchApp').service('YoutubeService', ['$rootScope', '$http', '$q', function($rootScope, $http, $q){
        var service = {};

        service.get = function(request){
            var deferred = $q.defer();
            var url = request.url + '&key=' + $rootScope.apiKey;
            $http.get(url).then(function(res){
                deferred.resolve(res);
            });
            return deferred.promise;
        }

       return service;
    }]);
})();
