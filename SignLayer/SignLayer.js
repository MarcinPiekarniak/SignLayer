import { CompositeLayer } from 'deck.gl';
import { BitmapLayer } from '../BitmapLayer';

function getPositionsSquare(feature) {
  let result = [];
  for (let i = 0; i < 4; ++i) {
    result.push(feature.geometry.coordinates[0][i]);
  }
  return result;
}

class SignLayer extends CompositeLayer {

  average(arr) {
    let res = [0,0];
    for (let i = 0; i < arr.length; ++i) {
      res[0] += arr[i][0];
      res[1] += arr[i][1];
    }
    res[0] /= arr.length;
    res[1] /= arr.length;
    return res;
  }

  generateData() {
    let data = [];

    geojson.features.forEach((feature) => {
        data.push({
          fontColor: '#fff',
          position: this.average(feature.geometry.coordinates[0]),
          positionsSquare: getPositionsSquare(feature),
          text: feature.properties.name,
          id: feature.properties.id,
        });
      }
    });
    return data;
  }

  renderLayers() {
    let data = this.generateData();

    let bitmapLayer = new BitmapLayer({
      id: `icon-layer-0`,
      data: data,
      opacity: 1,
      fp64: false,
      parameters: {
        depthTest: false,
      },
    });

    return [bitmapLayer];
  }
};

export { SignLayer };
