import type { IMIDIConverter, MeasureTimemap } from './interfaces/IMIDIConverter';
import type { IXSLTProcessor } from './interfaces/IXSLTProcessor';
import { PlayerOptions } from './Player';
import { SaxonJSAdapter } from './adapters/SaxonJSAdapter';
import { assertIsDefined, fetish, parseMusicXmlTimemap } from './helpers';

/**
 * Implementation of IMIDIConverter that queries the musicxml-midi API (@see https://github.com/infojunkie/musicxml-midi)
 * to convert a MusicXML to a MIDI file. It extracts the timemap contained within the MIDI file, expressed as MIDI marker events.
 */
export class MmaConverter implements IMIDIConverter {
  protected _version?: {
    name: string;
    version: string;
  };
  protected _midi?: ArrayBuffer;
  protected _timemap?: MeasureTimemap;
  protected _uri;
  protected _xsltProcessor: IXSLTProcessor;

  constructor(
    uri: string,
    protected _parameters?: Record<string, string>,
    xsltProcessor?: IXSLTProcessor,
  ) {
    this._uri = uri.endsWith('/') ? uri.slice(0, -1) : uri;
    this._xsltProcessor = xsltProcessor || new SaxonJSAdapter();
  }

  async initialize(musicXml: string, options: Required<PlayerOptions>): Promise<void> {
    // First get the API version.
    this._version = await (await fetish(`${this._uri}/`)).json();

    // Convert the score.
    const formData = new FormData();
    formData.append('musicXml', new Blob([musicXml], { type: 'text/xml' }));
    if (this._parameters) {
      for (const parameter in this._parameters) {
        formData.append(parameter, this._parameters[parameter]);
      }
    }
    const response = await fetish(`${this._uri}/convert`, {
      method: 'POST',
      body: formData,
    });
    this._midi = await response.arrayBuffer();
    this._timemap = await parseMusicXmlTimemap(musicXml, options.timemapXslUri, this._xsltProcessor);
  }

  get midi(): ArrayBuffer {
    assertIsDefined(this._midi);
    return this._midi;
  }

  get timemap(): MeasureTimemap {
    assertIsDefined(this._timemap);
    return this._timemap;
  }

  get version(): string {
    return `${this._version?.name ?? 'musicxml-midi'} v${this._version?.version ?? 'Unknown'}`;
  }
}
