import SaxonJS from '../saxon-js/SaxonJS3.rt';

/**
 * Unroll the MusicXML score by expanding all repeats and jumps into a linear score.
 */
export async function unrollMusicXml(
  musicXml: string,
  unrollXslUri: string,
): Promise<string> {
  try {
    const unroll = await SaxonJS.transform(
      {
        stylesheetLocation: unrollXslUri,
        sourceText: musicXml,
        destination: 'serialized',
        stylesheetParams: {
          renumberMeasures: true,
        },
      },
      'async',
    );
    return unroll.principalResult;
  } catch (error) {
    console.error(`[unrollMusicXml] ${error}`);
  }
  return musicXml;
}
