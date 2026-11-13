# Credits

## Environment map

`public/environment/studio-small-09-256.hdr` — derived from
**"Studio Small 09" by Sergej Majboroda**, from
[Poly Haven](https://polyhaven.com/a/studio_small_09). Licensed **CC0**.

The published 1k file (1024 × 512, 1.58 MB) was downsampled to 256 × 128
(128 KB) with `scripts/downsample-hdr.ts`, which is in this repository:

```sh
curl -sLO https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr
npx tsx scripts/downsample-hdr.ts studio_small_09_1k.hdr \
  public/environment/studio-small-09-256.hdr 256
```

The reduction is not a compromise, and it was checked rather than assumed: the
map is never seen directly — it is filtered into an irradiance map and a few
blurry specular mips — and the unit's surfaces are matte wood and powder coat.
Rendering the same configuration with both files and comparing the two images
channel by channel gives a mean difference of **0.036 / 255** and a maximum of
**2 / 255**, with no pixel differing by more than that. The 1k file was four
times the weight of all the JavaScript the 3D view loads.

It lights the scene and provides its reflections; it is not a model of a shelf.
The geometry is generated in code, because a model cannot change its own
dimensions and this unit has to.

## Everything else

Geometry, materials, lighting, shadow, interface and copy: written for this
project. No component library, no icon set, no stock imagery, no downloaded
models.
