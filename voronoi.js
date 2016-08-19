// Cut Branches or Cut Patches
// Branch Diameter
//   - 1x bit diameter
//   - 1.5x bit diameter
//   - 2x bit diameter
//   - 2.5x bit diameter

var properties = [
  {type: 'range', id: "Patches", value: 10, min: 3, max: 100, step: 1},
  {type: 'list', id: "Cut", options: ["Branches", "Patches"], value: "Branches"},
  {type: 'range', id: "Branch Size (x bit dia.)", value: 1, min: 1, max: 4, step: 0.5}
];

var executor = function(args, success, failure) {
  var exists = function(o) {
    return o !== null && typeof(o) !== 'undefined';
  }

  var getSelectedVolumes = function(volumes, selectedVolumeIds) {
    return volumes.filter(function(volume) {
      return selectedVolumeIds.indexOf(volume.id) !== -1;
    });
  };

  var d3PointsToPathVolume = function(points) {
    var volumePoints = points.map(function(p) {
      return {x: p[0], y: p[1]};
    });
    volumePoints.push(volumePoints[0]);

    return EASEL.pathUtils.fromPointArrays([volumePoints]);
  };

  var clippedVoronoiVolumes = function(voronoiVolumes, selectedVolumes) {
    var closeVolume = function(pathVolume) {
      var firstPoint, lastPoint, points;

      pathVolume.shape.points.forEach(function(points) {
        if (points.length > 1) {
          firstPoint = points[0];
          lastPoint = points[points.length - 1];

          if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y || firstPoint.lh !== lastPoint.lh || firstPoint.rh !== lastPoint.rh) {
            points.push(firstPoint);
          }
        }
      });

      return pathVolume;
    }

    var intersect = function(voronoiVolumes, selectedVolumes) {
      var firstShapeDepth = selectedVolumes[0].cut.depth;
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

      return clippedVolumes.filter(exists).map(closeVolume);
    }

    return intersect(voronoiVolumes, selectedVolumes);
  };

  // An object to help identify coincident line segments
  var segmentCache = function() {
    var segments = {};

    var that = {};

    var roundCoordinate = function(val) {
      return Math.floor(val * 100000);
    };

    var partialKey = function(point) {
      return roundCoordinate(point.x) + ":" + roundCoordinate(point.y);
    }

    var key = function(p1, p2) {
      return partialKey(p1) + "-" + partialKey(p2);
    };

    that.has = function(p1, p2) {
      return segments[key(p1, p2)];
    };

    that.put = function(p1, p2) {
      segments[key(p1, p2)] = true;
    };

    return that;
  };

  var removeCoincidentLines = function(voronoiVolumes) {
    var segments = segmentCache();

    voronoiVolumes = voronoiVolumes.map(function(volume) {
      var newSubPaths = [];

      volume.shape.points.forEach(function(points) {
        var previousPoint = null;
        var goodPoints = [];
        var subPaths = [];

        points.forEach(function(point) {
          if (previousPoint !== null) {
            // Check if the reverse direction has been added already
            if (segments.has(point, previousPoint)) {
              // Already have segment
              if (goodPoints.length > 0) {
                subPaths.push(goodPoints);
                goodPoints = [];
              }
            } else {
              // New segment, keep it & mark it
              if (goodPoints.length === 0) {
                goodPoints.push(previousPoint);
              }
              goodPoints.push(point);

              segments.put(previousPoint, point);
            }
          }
          previousPoint = point;
        });

        if (goodPoints.length !== 0) {
          subPaths.push(goodPoints);
        }

        if (subPaths.length > 0) {
          // Polygon has some new segments and some duplicated segments
          newSubPaths = newSubPaths.concat(subPaths);
        }
      });

      if (newSubPaths.length === 0) {
        return null;
      } else {
        volume.shape = EASEL.pathUtils.fromPointArrays(newSubPaths).shape;

        return volume;
      }
    });

    return voronoiVolumes.filter(exists);
  };

  var generate = function() {
    var propertyParams = args.params;
    var pointCount = propertyParams["Patches"];

    var selectedVolumes = getSelectedVolumes(args.volumes, args.selectedVolumeIds);

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
    //var voronoiPathVolume = makePathFromEdges(diagram.edges);

    var polygons = diagram.polygons().filter(exists);

    var voronoiVolumes = polygons.map(d3PointsToPathVolume);
    voronoiVolumes = clippedVoronoiVolumes(voronoiVolumes, selectedVolumes);

    if (propertyParams["Cut"] == "Branches" && propertyParams['Branch Size (x bit dia.)']) {
      voronoiVolumes = removeCoincidentLines(voronoiVolumes);
    }

    success(voronoiVolumes);
  };

  generate();
};

