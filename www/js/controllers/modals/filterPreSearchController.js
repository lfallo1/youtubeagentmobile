(function() {
    angular.module('youtubeSearchApp').controller('FilterPreSearchModalCtrl', [
        '$rootScope', '$scope', '$http', '$q', '$log', function ($rootScope, $scope, $http, $q, $log) {

            $scope.save = function() {
                $scope.preSearchModal.hide();
            };

        }])
})();