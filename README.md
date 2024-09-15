# website-song-generator

procedural music thing thrown together haphazardly in about 12 hours

### ? 
see https://cohost.org/viv/post/7729629-compost-6-website/

### how does it work?

at a high level:
1. collect performance entries from the current page via `window.performance.getEntries()` and get their timings
2. divide a measure into a number of 'buckets' (i don't know music theory)
3. define the set of buckets; the number of measures * the number of buckets per measure
4. try to fit the perf entries into a bucket. if they go past the end, they wrap around until they fit into a bucket (modulo)
5. depending on which measure a bucket is in, drop some of its items randomly ('sample factor')
6. stitch together a composition based on a specified ordering of measures. for example `[0,1,0,2,0,1,0,3]` will repeat the first measure 4 times, the second measure 2 times, and the third and fourth measures will play once
7. go through the measures in order and transform the perf entries into notes:
    a. group entries in a bucket by content type.
    b. the content type map defines some properties that the note will have, like the shape of the wave and some multipliers
    c. multiply the transfer size of the entry (e.g. if downloading a png, how big it was), and come up with a frequency using the mapping sizePitchFactor and pitchCap
    d. map that pitch to the nearest note by using the [tonal](https://github.com/tonaljs/tonal) library (many of the following operations will also use tonal)
    e. map *that* note into the nearest note that is in the current key's scale
    f. emit a note
    g. if there were other entries with the same content type at the same time, try to find a matching chord in the key
    h. take n notes from that chord where n is the number of other entries
8. play them in order until reaching the end of a loop. then the process repeats if 'play' is checked.

### how to run
copy the contents of `dist/main.min.js` or `dist/main.js`, paste them into the browser devtools console, press enter

### how to use
if you check the 'play' box it'll play. adjust the parameters accordingly

todo: document the parameters

### how to build

```
npx webpack
```
