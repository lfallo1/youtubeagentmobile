(function() {
    angular.module('youtubeSearchApp').controller('FilterPostSearchModalCtrl', [
        '$rootScope', '$scope', '$http', '$q', '$log', function ($rootScope, $scope, $http, $q, $log) {

            $scope.save = function() {
                $scope.postSearchModal.hide();
            };

        }])
})();