/**
 * TimeService.js - handle converting of iso 8601 time
 */
(function() {
    angular.module('youtubeSearchApp').service('TimeService', ['$log', function timeService($log) {

        var service = {};

        /**
         * Time Object - takes an hour, minute, second.
         * contains two functions. one returns a formatted duration string, and the other returns the duration in minutes
         * @param h
         * @param m
         * @param s
         * @constructor
         */
        function MyTime(h,m,s){
            this.h = h;
            this.m = m;
            this.s = s;

            this.formatted = function(){
                var hours = !this.h ? '00' : Number(this.h) < 10 ? '0' + this.h : this.h;
                var minutes = !this.m ? '00' : Number(this.m) < 10 ? '0' + this.m : this.m;
                var seconds = !this.s ? '00' : Number(this.s) < 10 ? '0' + this.s : this.s;
                return hours + ':' + minutes + ':' + seconds;
            };

            this.minutes = function(){
                var hours = this.h || 0;
                var minutes = this.m || 0;
                var seconds = this.s || 0;
                return (Number(hours) * 60) + Number(minutes) + (Number(seconds) / 60);
            };
        }

        /**
         * convert time from iso 8601 to a duration in minutes and formatted duration string (hh:mm:ss)
         * iso 8601 comes in form PT#H#M#S, where the # represents the numerical value of each duration part.
         * i.e., PT4H13M59S represents a video 4hours 13mins 59secs
         * @param duration
         * @returns {{formatted, approxMinutes}}
         */
        service.isoToDuration = function(duration) {
            var hours, minutes, seconds = null;
            var stripped = duration.replace("PT","");
            var number = '';
            var char = '';
            for(var i = 0; i < stripped.length; i++) {
                char = stripped.substring(i, i + 1);
                if (isNaN(char)) {
                    switch (char) {
                        case 'H':
                            hours = number;
                            break;
                        case 'M':
                            minutes = number;
                            break;
                        case 'S':
                            seconds = number;
                            break;
                        default:
                            break;
                    }
                    number = '';
                }
                else{
                    number = number.toString() + char.toString();
                }
            }
            time = new MyTime(hours, minutes, seconds);
            return {
                'formatted' : time.formatted(),
                'approxMinutes' : time.minutes()
            }
        };

        return service;
    }]);

})();