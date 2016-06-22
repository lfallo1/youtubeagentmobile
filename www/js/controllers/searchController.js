/**
 * HomeCtrl.js - Primvary controller. Handles the loading of videos, sorting and filtering.
 */
(function(){
    angular.module('youtubeSearchApp').controller('SearchCtrl', [
        '$rootScope', '$scope', '$http', '$q', '$log', '$timeout', '$location', 'TimeService', '$window','$sce', 'YoutubeService', '$ionicModal',
        function($rootScope, $scope, $http, $q, $log, $timeout, $location, TimeService, $window,  $sce, YoutubeService, $ionicModal){

            var youtubeSearchBase = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=';
            var youtubeVideoBase = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=';
            var popularByCountryBase = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&maxResults=50&chart=mostPopular&regionCode=';
            var youtubeVideoCategoriesBase = 'https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=';

            var sortOrders = [];
            var ALL_CATEGORIES = {'id' : '-1', 'snippet' : {'title' : 'Search All Categories'}};
            var relatedPending = false;
            var iteration = 0;

            var regionCode = '';
            var related= '';
            var videoDuration= '';
            var videoCategoryId= '';
            var safeSearch= '';

            /**
             * SortOption object
             * @param value
             * @param direction
             * @param glyph
             * @param displayName
             * @constructor
             */
            function SortOption(value, direction, glyph, displayName){
                this.value = value;
                this.direction = direction;
                this.glyph = glyph;
                this.displayName = displayName;
            };

            /**
             * setup view
             */
            var init = function(){

                $scope.extendedSearch = false;
                $scope.watchlist = [];
                $scope.selectedVideos = [];

                $scope.sortField = {'value' : 'viewCount'};
                $scope.searchMode = $scope.TEXT_SEARCH;
                $scope.totalResults = 0;
                $scope.search = {searchParam : ''};
                $scope.searchResults = $scope.filteredResults = [];

                $scope.postfilter = {};
                $scope.prefilter = {};

                //setup sort options (each sort option will be used for a search). different sort options
                //are used to increate search results
                $scope.sortOptions = [
                    new SortOption('viewCount', -1, 'eye', 'Views'),
                    new SortOption('likes', -1, 'thumbsdown', 'Likes'),
                    new SortOption('dislikes', 1, 'thumbsdown', 'Dislikes'),
                    new SortOption('pctLikes', -1, 'star', 'Rating')
                ];
                $scope.sortObject = $scope.sortOptions[0];
            };

            $scope.reset = function(){
                $scope.searchResults = [];
                $scope.filteredResults = [];
            };

            $scope.setPlaying = function(video, val){
                video.playing = val;
            };

            $scope.getIFrameSrc = function (videoId) {
                return $sce.trustAsResourceUrl('https://www.youtube.com/embed/' + videoId);
            };

            $scope.sortOptionChanged = function(option){
                $scope.sortField.value = option.value;
                //$scope.sort();
            };

            /**
             * Interrupt a search
             */
            $scope.interrupt = function(){
                relatedPending = false;
                $scope.related = undefined;
                $scope.checkRelated = false;
                $scope.checkRelated = false;
                $scope.wasInterrupted = true;
                $scope.fetching = false;
            };

            /**
             * Handle a finished search
             * @param msg
             * @param toasterType
             */
            var stopSearch = function(msg, toasterType){
                $scope.fetching = false;
            };

            /**
             * reset sort order objects (main purpose of this is to reset the tokens)
             */
            var resetSortOrders = function(){
                sortOrders = [
                    {order : 'relevance', token : ''},
                    {order : 'rating', token : ''},
                    {order : 'date', token : ''},
                    {order : 'viewCount', token : ''},
                    {order : 'title', token : ''}
                ];
            };

            /**
             * perform a new search
             */
            $scope.doSearch = function(){

                //if already searching, just return immediately
                if($scope.fetching){
                    return;
                }

                //if a search term exists
                $scope.search.searchParam =  $scope.search.searchParam.trim();
                if( $scope.search.searchParam){

                    iteration = 0;
                    $scope.related = undefined;
                    $scope.nextRelated = [];
                    $scope.checkRelated = false;
                    relatedPending = true;

                    resetSortOrders();
                    $scope.searchResults = [];

                    $scope.wasInterrupted = undefined;
                    $scope.fetching = true;

                    videoDuration = $scope.prefilter.duration ? '&videoDuration=' + $scope.prefilter.duration : '';
                    safeSearch = $scope.prefilter.safesearch ? '&safeSearch=' + $scope.prefilter.safesearch : '';

                    //call the wrapper
                    fetchResultsWrapper(0);
                }
            };

            /**
             * method that accepts an iteration number, and whether or not to cancel the search.
             * The method calls fetch results, then waits for all requests to finish.
             * If the yearlySearch is on, it will perform 5 additional searches between date spans to help improve results
             * @param iteration
             * @param cancel
             */
            var fetchResultsWrapper = function(iteration, cancel){

                //if cancel passed in (used if errors occur, and we want to the search to end
                if(cancel){
                    return;
                }

                var dateLarge = $scope.prefilter.maxDate ? "&publishedBefore=" + $scope.prefilter.maxDate.toISOString() : '';
                var dateSmall = $scope.prefilter.minDate ? "&publishedAfter=" + $scope.prefilter.minDate.toISOString() : '';

                //fetch results, passing the date range (the date ranges can be empty)
                fetchResults(dateSmall, dateLarge).then(function(){
                    stopSearch('Finished search', 'info');
                    relatedPending = false;
                    return;
                }, function(err){
                    stopSearch('Finished search', 'info');
                    relatedPending = false;
                    return;
                });
            };

            /**
             * fetches the actual results
             * @param dateSmall (can be an empty string)
             * @param dateLarge (can be an empty string)
             * @param promise (optional)
             * @returns {*}
             */
            var fetchResults = function(dateSmall, dateLarge, promise){

                var deferred = promise || $q.defer();

                if($scope.wasInterrupted){
                    deferred.reject(true);
                    return;
                }

                var promises = [];

                related = $scope.checkRelated && $scope.related ? '&relatedToVideoId=' + $scope.related : '';

                //for each sort order type, execute the GET request.  doing this so that more results are returned.
                for (var i = 0; i < sortOrders.length; i++) {
                    var token = sortOrders[i].token ? '&pageToken=' + sortOrders[i].token : '';

                    promises.push(YoutubeService.get({'url' : youtubeSearchBase +  $scope.search.searchParam + "&type=video&maxResults=50" +
                    dateSmall + dateLarge + regionCode + videoDuration + videoCategoryId + safeSearch +
                    "&order=" + sortOrders[i].order + related  + token}));
                }

                //wait for all requests to complete
                $q.all(promises).then(function (res) {

                    //no results, then check how many warningss (after no results for two consecutive passes, then bail).
                    //otherwise, try again
                    if (!res || res.length === 0) {
                        deferred.resolve();
                        return;
                    }

                    //otherwise there are items
                    var nonDuplicates = [];
                    for (var i = 0; i < res.length; i++) {

                        //set next page tokens
                        for (var j = 0; j < sortOrders.length; j++) {
                            sortOrders[j].token = res[0].data.nextPageToken;
                        }

                        //get all items from response
                        var items = res[i].data.items;

                        //loop through all items in response
                        for (var j = 0; j < items.length; j++) {

                            //check if already exists in main array or temp nonDuplicates array
                            if ($scope.searchResults.filter(function (d) {
                                    if (d.videoId == items[j].id.videoId) {
                                        return d;
                                    }
                                }).length === 0 && nonDuplicates.filter(function (d) {
                                    if (d.id.videoId === items[j].id.videoId) {
                                        return d;
                                    }
                                }).length === 0) {
                                nonDuplicates.push(items[j]);
                            }
                        }
                    }

                    //query the statistics for each video
                    var promises = [];
                    for (var i = 0; i < nonDuplicates.length; i++) {

                        //create list of video id's (max list size of 50).
                        var count = 0;
                        var idList = [];
                        while (count < 50 && i < nonDuplicates.length) {
                            idList.push(nonDuplicates[i].id.videoId);
                            i++;
                            count++;
                        }

                        //create a promise with list of video id's for the batch request
                        var payload = {'url' : youtubeVideoBase + idList.toString()};
                        promises.push(YoutubeService.get(payload));
                    }

                    if(promises.length === 0){
                        deferred.resolve();
                        return;
                    }

                    //wait for request to finish
                    $q.all(promises).then(function (res) {

                        var data = [];
                        for (var i = 0; i < res.length; i++) {
                            data = data.concat(res[i].data.items);
                        }

                        //populated related video id's (for now, only populating during first pass)
                        if(relatedPending && $scope.nextRelated.length < 100){

                            //split search term(s) into array
                            var parts =  $scope.search.searchParam.toLowerCase().split(' ' );

                            //loop over each returned video
                            for(var count = data.length - 1; count >= 0; count--){

                                //if the video has tags
                                if(data[count].snippet.tags){

                                    //get the tags
                                    var terms = data[count].snippet.tags.toString().toLowerCase();

                                    var isRelevant = false;

                                    //check if tags match what we searched for
                                    for(var i = 0; i < parts.length; i++){

                                        //if for any term in our search, it does NOT exist in the videos's tags, then we consider it not a relevant match
                                        if(terms.toLowerCase().indexOf(parts[i]) > -1){
                                            isRelevant = true;
                                            break;
                                        }
                                    }

                                    if(!isRelevant){
                                        terms = data[count].snippet.title.toString().toLowerCase();
                                        for(var i = 0; i < parts.length; i++){

                                            //if for any term in our search, it does NOT exist in the videos's tags, then we consider it not a relevant match
                                            if(terms.toLowerCase().indexOf(parts[i]) > -1){
                                                isRelevant = true;
                                                break;
                                            }
                                        }
                                    }

                                    //if relevant (terms are similar), then add to related list
                                    if(isRelevant){
                                        $scope.nextRelated.push(data[count].id);
                                    }

                                    //allow max of 100 related videos
                                    if($scope.nextRelated.length >= 100){
                                        break;
                                    }
                                }
                            }
                        }

                        addVideosToList(data);

                        $scope.sort();
                        //$scope.filteredResults = $scope.searchResults;

                        fetchResults(dateSmall, dateLarge, deferred);
                    }, function (err) {
                        deferred.reject();
                        stopSearch('Service unavailable', 'error');
                    })

                }, function (err) {
                    deferred.reject();
                    stopSearch('Service unavailable', 'error');
                });

                return deferred.promise;
            };

            var addVideosToList = function(data){
                //for each video, add to the list
                for (var i = 0; i < data.length; i++) {
                    var datastats = data[i];
                    if (datastats) {
                        var title = datastats.snippet.title;
                        var channelTitle = datastats.snippet.channelTitle;
                        var channelId = datastats.snippet.channelId;
                        var created = new Date(datastats.snippet.publishedAt);
                        var id = datastats.id;

                        //format the pct likes
                        var pctLikes;
                        if (datastats.statistics.likeCount) {
                            pctLikes = (Number(datastats.statistics.likeCount) / (Number(datastats.statistics.likeCount) + Number(datastats.statistics.dislikeCount))) * 100
                        }
                        else if (datastats.statistics.dislikeCount) {
                            pctLikes = 0;
                        }
                        else {
                            pctLikes = undefined;
                        }

                        var viewCount = datastats.statistics.viewCount;
                        var likes = datastats.statistics.likeCount;
                        var dislikes = datastats.statistics.dislikeCount;

                        //extract duration from ISO 8601 (PT#H#M#S)
                        var duration = {};
                        if (datastats.contentDetails) {
                            duration = TimeService.isoToDuration(datastats.contentDetails.duration);
                        }

                        //add object to search results
                        $scope.searchResults.push({
                            "title": title,
                            "channelTitle": channelTitle,
                            "channelId": channelId,
                            "created": created,
                            "videoId": id,
                            "pctLikes": pctLikes || 0,
                            "viewCount": Number(viewCount),
                            "likes": Number(likes) || 0,
                            "dislikes": Number(dislikes) || 0,
                            "thumbnail": datastats.snippet.thumbnails.medium,
                            "duration": duration.formatted || null,
                            "durationMinutes": duration.approxMinutes || null
                        });
                    }
                }
            };

            $scope.sort = function(){
                $scope.searchResults = $scope.searchResults.sort(function(a,b){
                    if(a[$scope.sortObject.value] > b[$scope.sortObject.value]){
                        return $scope.sortObject.direction;
                    } else if(a[$scope.sortObject.value] < b[$scope.sortObject.value]){
                        return -$scope.sortObject.direction;
                    }
                    return 0;
                });
                $scope.filter();
            };

            $scope.filter = function(){
                if(!$scope.prefilter.minViews && (!$scope.prefilter.minDislikes && $scope.prefilter.minDislikes !== 0) && !$scope.prefilter.minDate && !$scope.prefilter.shorterThan && !$scope.prefilter.longerThan && !$scope.prefilter.minRating){
                    $scope.filteredResults = $scope.searchResults;
                    return;
                }
                $scope.filteredResults = $scope.searchResults.filter(function(d){
                    if(((!$scope.prefilter.minDislikes && $scope.prefilter.minDislikes !== 0) || d.dislikes <= $scope.prefilter.minDislikes) &&
                        (!$scope.prefilter.minViews || d.viewCount >= $scope.prefilter.minViews) &&
                        (!$scope.prefilter.minRating || d.pctLikes >= $scope.prefilter.minRating) &&
                        (!$scope.prefilter.maxDate || d.created >= $scope.prefilter.maxDate) &&
                        (!$scope.prefilter.minDate || d.created >= $scope.prefilter.minDate) && durationFilter(d)){
                        return d;
                    }
                });
            };

            var durationFilter = function(video){
                //for clarity split up statements
                //1. if video.durationMinutes is not defined, then return true immediately
                //2. otherwise check the filters
                if(isNaN(video.durationMinutes) || !video.durationMinutes){
                    return true;
                }

                if($scope.longerThan >= $scope.shorterThan || $scope.shorterThan < 0){
                    $scope.shorterThan = '';
                }

                if($scope.longerThan < 0){
                    $scope.longerThan = 0;
                }

                return (isNaN($scope.longerThan) || video.durationMinutes >= $scope.longerThan) &&
                    (isNaN($scope.shorterThan) || !$scope.shorterThan || video.durationMinutes <= $scope.shorterThan)
            };

            /**
             * MODALS
             */
            $ionicModal.fromTemplateUrl('templates/modals/filterPreSearchModal.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function(modal) {
                $scope.preSearchModal = modal;
            });
            $ionicModal.fromTemplateUrl('templates/modals/filterPostSearchModal.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function(modal) {
                $scope.postSearchModal = modal;
            });
            $ionicModal.fromTemplateUrl('templates/modals/sortModal.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function(modal) {
                $scope.sortModal = modal;
            });

            $scope.openPreSearchModal = function() {
                $scope.activeModal = 'filterPreSearchModal';
                $scope.preSearchModal.show();
            };
            $scope.openPostSearchModal = function() {
                $scope.activeModal = 'filterPostSearchModal';
                $scope.postSearchModal.show();
            };
            $scope.openSortModal = function() {
                $scope.activeModal = 'sortModal';
                $scope.sortModal.show();
            };

            $scope.$on('$destroy', function(){
                $scope.preSearchModal.remove();
                $scope.postSearchModal.remove();
            });

            $scope.pick = function(sortObject) {
                $scope.selectedSort = sortObject.value;
                $scope.sortModal.hide();
            };

            $scope.$on('modal.hidden', function() {
                if($scope.activeModal === 'filterPostSearchModal'){
                    $scope.sort();
                }
                else if($scope.activeModal === 'filterPreSearchModal'){
                    $log.info($scope.prefilter);
                }
                else if($scope.activeModal === 'sortModal'){
                    $scope.sortObject = $scope.sortOptions.filter(function(d){if(d.value === $scope.selectedSort){return d;}})[0];
                    $scope.sort();
                }
            });


            init();

        }]);
})();