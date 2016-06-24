(function() {
    angular.module('youtubeSearchApp').controller('FilterModalCtrl', [
        '$rootScope', '$scope', '$http', '$q', '$log', function ($rootScope, $scope, $http, $q, $log) {

            $scope.save = function() {
                $scope.filterModal.hide();
            };

        }])
})();
