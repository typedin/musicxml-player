import type { IMIDIConverter, MeasureTimemap } from './IMIDIConverter';
import { MuseScoreDownloader, MuseScoreBase } from './MuseScoreBase';
import { IXSLTProcessor } from './interfaces/IXSLTProcessor';
<<<<<<< HEAD
<<<<<<< HEAD
=======

>>>>>>> cf0517e (Re-add soundfont)
=======
>>>>>>> 8bee09f (extracted an interface for XSLT processing)
/**
 * Implementation of IMIDIConverter that uses MuseScore to generate the MIDI and timemap structures.
 */
export declare class MuseScoreConverter extends MuseScoreBase implements IMIDIConverter {
  constructor(downloader: string | MuseScoreDownloader | ReturnType<MuseScoreDownloader>, xsltProcessor: IXSLTProcessor);
  initialize(musicXml: string): Promise<void>;
  get midi(): ArrayBuffer;
  get timemap(): MeasureTimemap;
  get version(): string;
}
//# sourceMappingURL=MuseScoreConverter.d.ts.map
