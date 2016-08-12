var properties = [
  {type: 'range', id: "Patches", value: 100, min: 3, max: 500, step: 1}
];

var executor = function(args, success, failure) {
  var notnull = function(o) {
    return o !== null;
  }

  var getSelectedVolumes = function(volumes, selectedVolumeIds) {
    var selectedVolumes = [];
    var volume;
    for (var i = 0; i < volumes.length; i++) {
      volume = volumes[i];
      if (selectedVolumeIds.indexOf(volume.id) !== -1) {
        selectedVolumes.push(volume);
      }
    }
    return selectedVolumes;
  };

  var pointsToPolygonVolume = function(points) {
    var volumePoints = points.map(function(p) {
      return {x: p[0], y: p[1]};
    });

    var getX = function(d) { return d.x; }
    var getY = function(d) { return d.y; }

    var xMin = d3.min(volumePoints, getX);
    var xMax = d3.max(volumePoints, getX);

    var yMin = d3.min(volumePoints, getY);
    var yMax = d3.max(volumePoints, getY);
  
    return {
      shape: {
        type: "polygon",
        flipping: {
          x: false,
          y: false
        },
        points: volumePoints,
        center: {
          x: (xMin + xMax) / 2,
          y: (yMin + yMax) / 2
        },
        width: xMax - xMin,
        height: yMax - yMin,
        rotation: 0
      },
      cut: {
        type: "outline",
        outlineStyle: "on-path",
        tabPreference: false,
        depth: firstShapeDepth
      }
    };
  };

  var clippedVoronoiVolumes = function(voronoiVolumes) {
    var closeVolume = function(pathVolume) {
      var firstPoint, lastPoint, points;

      if (pathVolume.shape.points.length != 1) {
        return pathVolume;
      }

      points = pathVolume.shape.points[0];

      if (points.length < 2) {
        return pathVolume;
      }

      firstPoint = points[0];
      lastPoint = points[points.length - 1];

      if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y || firstPoint.lh !== lastPoint.lh || firstPoint.rh !== lastPoint.rh) {
        points.push(firstPoint);
      }

      return pathVolume;
    }

    var intersect = function(voronoiVolumes, selectedVolumes) {
      var solutions = [];
      var clipVolume;

      var clippedVolumes = voronoiVolumes.map(function(voronoiVolume) {
        clipVolume = EASEL.volumeHelper.intersect(selectedVolumes, [voronoiVolume]);
        if (clipVolume !== null) {
          clipVolume.cut = {
            type: "outline",
            outlineStyle: "on-path",
            tabPreference: false,
            depth: firstShapeDepth
          };
        }
        return clipVolume;
      });

      return clippedVolumes.filter(notnull).map(closeVolume);
    }

    return intersect(voronoiVolumes, selectedVolumes);
  };

  var propertyParams = args.params;
  var pointCount = propertyParams["Patches"];

  var selectedVolumes = getSelectedVolumes(args.volumes, args.selectedVolumeIds);
  var firstShapeDepth = selectedVolumes[0].cut.depth;

  var right = EASEL.volumeHelper.boundingBoxRight(selectedVolumes);
  var left = EASEL.volumeHelper.boundingBoxLeft(selectedVolumes);
  var top = EASEL.volumeHelper.boundingBoxTop(selectedVolumes);
  var bottom = EASEL.volumeHelper.boundingBoxBottom(selectedVolumes);
  var width = right - left;
  var height = top - bottom;

  var vertices = d3.range(pointCount).map(function(d) {
    return [Math.random() * width + left, Math.random() * height + bottom];
  });

  var voronoi = d3.voronoi().extent([[left, bottom], [right, top]]);
  var diagram = voronoi(vertices);
  var polygons = diagram.polygons().filter(notnull);

  var voronoiVolumes = polygons.map(pointsToPolygonVolume);

  voronoiVolumes = clippedVoronoiVolumes(voronoiVolumes);

  success(voronoiVolumes);
};

