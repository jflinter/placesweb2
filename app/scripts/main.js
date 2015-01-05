'use strict';

var Leaflet = L.noConflict();

function home () {

}

function show (ctx) {
  var map = initializeMap();
  unShortenUrl(ctx.params.shortened, function(mapId) {
    if (!mapId) {
      page('*');
      return;
    }
    fetchMapData(mapId, function(name, places) {
      $(".title").text(name);
      var markers = _.map(places, function(place) {
        var marker = Leaflet.marker([place.latitude, place.longitude], {
          icon: Leaflet.icon({
            iconUrl: isRetinaDisplay() ? "images/pin@2x.png" : "images/pin.png",
            iconSize: [28, 72],
            iconAnchor: [14, 54],
            shadowSize: [0, 0],
          })
        });

        var firstLine, rest, address = "";
        if (place.caption) {
          var lines = place.caption.split("\n");
          if (lines.length) {
            firstLine = lines[0];
            rest = lines.splice(1).join("<br>");
          }
        }
        if (place.geocodedAddress && place.geocodedAddress.FormattedAddressLines) {
          address = place.geocodedAddress.FormattedAddressLines.join(", ");
        }
        var imageIds = ""
        if (place.imageIds && place.imageIds[0]) {
          imageIds = "data-imageid='" + place.imageIds[0] + "'";
        }
        var content = "<div class='marker-content' data-placeid='" + place.id + "'" + imageIds +">" +
        "<div class='marker-title'>" +
        firstLine +
        "</div>" +
        "<div class='marker-body'>" +
        rest +
        "</div>" +
        "<div class='spinner-container'>" +
        "</div>" +
        "<div class='marker-image'>" +
        "</div>" +
        "<div class='marker-footer'>" +
        address +
        "</div>" +
        "</div>";

        marker.bindPopup(content, {
          closeButton: false,
          autoPan: false,
          minWidth: 200,
          maxWidth: 200,
          offset: [0, -28]
        });
        marker.addTo(map);
        return marker;
      });
      if (places.length > 0) {
        map.fitBounds([
          [_.max(_.map(places, 'latitude')), _.max(_.map(places, 'longitude'))],
          [_.min(_.map(places, 'latitude')), _.min(_.map(places, 'longitude'))]
        ], {
          padding: [20, 20]
        });
      }
    });
  });
  var lc = Leaflet.control.locate({
    follow: false,
    setView: false,
    markerClass: L.circleMarker,
    onLocationError: function(err) {},
    markerStyle: {
      clickable: false,
      pointerEvents: 'none',
      className: 'locate-circle'
    },
    locateOptions: {
      watch: false
    }
  }).addTo(map);
  lc.locate();

  map.on('popupopen', function(event) {
    var html = event.popup._container;
    $(html).addClass("animated-popup");
    var popup = event.popup;

    var zoom = map.getZoom();
    var latlng = popup._latlng;
    var diff = 70;
    var targetPoint = map.project(latlng, zoom).subtract([0, diff]);
    latlng = map.unproject(targetPoint, zoom);
    map.setView([latlng.lat, latlng.lng, zoom]);

    var imageId = $(popup._content).data('imageid');
    if (imageId) {
      var query = encodeURIComponent('{"imageId":"' + imageId + '"}');
      var url = 'https://api.parse.com/1/classes/Photo/?where=' + query;
      var mySpinner = spinner();
      $(popup._container).find(".spinner-container").show().append(mySpinner.el);
      $.ajax({
        dataType: "json",
        localCache: true,
        url: url,
        headers: {
          "X-Parse-Application-Id": "d7IlXMx8MHI3emtHCF5LjKhVXm787WSWHyfKY9w5",
          "X-Parse-REST-API-Key": "zysGLuJn3owJfEfmJTWOvKfUK2Gk1GtI9qI7kWLA",
        },
        success: function(data) {
          $("<img class='places-image' />").attr('src', data.results[0].imageFile.url).load(function() {
            if (this.complete) {
              $(event.popup._container).find(".marker-image").html(this);
            }
            $(popup._container).find(".spinner-container").hide()
            mySpinner.stop();
            var that = this;
            setTimeout(function() { $(that).addClass("visible") }, 50);
          });
        },
        failure: function() {
          mySpinner.stop();
        }
      })
    }
  });

  map.on('dragstart', function(event) {
    if (map._popup) {
      $(map._popup._container).removeClass("animated-popup");
      setTimeout(function(){
        map.closePopup();
      }, 100)
    }
  });
  map.on('zoomstart', function(event) {
    if (map._popup) {
      $(map._popup._container).removeClass("animated-popup");
      setTimeout(function(){
        map.closePopup();
      }, 100)
    }
  });
}

function initializeMap() {
  var tileFormatSuffix = isRetinaDisplay() ? "@2x.png" : ".png";
  var tileLayer = "https://a.tiles.mapbox.com/v3/jflinter.icfgg4f5/{z}/{x}/{y}" + tileFormatSuffix;
  var map = Leaflet.map('map', {
    closePopupOnClick: false
  }).fitBounds(
    [
      [50.0077390146369, -55.8984375],
      [22.836945920943855, -138.25195312499997]
    ], {

    }
  );
  Leaflet.tileLayer(tileLayer, {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      maxZoom: 18,
      detectRetina: true
  }).addTo(map);
  return map;
}

function fetchMapData(mapId, callback) {
  $.getJSON('https://shareplaces.firebaseio.com/maps/' + mapId + '.json', function(data) {
    var places = _.filter(_.map(data.places, function(place, placeId) {
      place.id = placeId;
      return place;
    }), function(place) {
      return !place.PLCDeletedAt;
    });
    callback(data.name, places);
  });
}

function unShortenUrl(arg, callback) {
  $.ajax({
    dataType: "json",
    localCache: true,
    cacheTTL: .5,
    url: 'https://shareplaces.firebaseio.com/urls/' + arg + '.json',
    success: callback
  })
}

function isRetinaDisplay() {
  var mediaQuery = "(-webkit-min-device-pixel-ratio: 1.5), (min--moz-device-pixel-ratio: 1.5), " +
    "(-o-min-device-pixel-ratio: 3/2), (min-resolution: 1.5dppx)";
  if (window.devicePixelRatio > 1) {
    return true;
  }
  return (window.matchMedia && window.matchMedia(mediaQuery).matches);
}

function spinner() {
  var opts = {
    lines: 9, // The number of lines to draw
    length: 5, // The length of each line
    width: 2, // The line thickness
    radius: 6, // The radius of the inner circle
    corners: 1, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#000', // #rgb or #rrggbb or array of colors
    speed: 1.5, // Rounds per second
    trail: 100, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: true, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '50%', // Top position relative to parent
    left: '50%' // Left position relative to parent
  };
  return new Spinner(opts).spin();
}

page('/:shortened', show);
page('*', home);
page({hashbang: true});
