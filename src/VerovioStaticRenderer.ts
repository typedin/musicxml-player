import { ISheetRenderer } from "./ISheetRenderer";
import { MeasureTimemapEntry } from './IMidiConverter';
import { TimeMapEntryFixed, VerovioBase } from "./VerovioBase";
import type { MeasureIndex, MillisecsTimestamp, Player } from './Player';
import { Cursor } from './Cursor';
import { assertIsDefined, fetish } from './helpers';
import pkg from '../package.json';

/**
 * Implementation of ISheetRenderer that uses statically-rendered Verovio assets:
 * - SVG files as obtained by `verovio --xml-id-checksum -t svg /path/to/score.musicxml`
 * - Timemap JSON file as obtained by `verovio --xml-id-checksum -t timemap --timemap-options '{ "includeMeasures": true, "includeRests": true }' /path/to/score.musicxml`
 */
export class VerovioStaticRenderer extends VerovioBase implements ISheetRenderer {
  player?: Player;
  protected _cursor: Cursor;
  protected _events?: (TimeMapEntryFixed & {
    rectNotes: DOMRect[],
    notesOn: string[],
  })[];
  protected _measures: (MeasureTimemapEntry & {
    eventEntry: number,
    rectMeasure: DOMRect,
    rectSystem: DOMRect,
  })[] = [];
  protected _currentNotes: {
    domid: string,
    fill: string | null,
    stroke: string | null,
  }[] = []; // Currently highlighted notes and their saved attributes
  protected _currentEventEntry?: number; // Currently highlighted event entry

  constructor(
    protected _svgOrUris: Array<ArrayBuffer | string>,
    protected _eventsOrUri: TimeMapEntryFixed[] | string,
  ) {
    super();
    this._cursor = new Cursor();
  }

  destroy(): void {
    this._cursor.destroy();
  }

  async initialize(container: HTMLElement, _musicXml: string) {
    // Fetch the files.
    const enc = new TextDecoder('utf-8');
    const svgs = await Promise.all(this._svgOrUris.map(async (svgOrUri) =>
      typeof svgOrUri === 'string'
        ? await (await fetish(svgOrUri)).text()
        : enc.decode(svgOrUri)
    ));
    const timemap =
      typeof this._eventsOrUri === 'string'
        ? await (await fetish(this._eventsOrUri)).json()
        : this._eventsOrUri;
    this._events = timemap.map((e: TimeMapEntryFixed) => { return {...e, rectNotes: [], notesOn: []}; });

    // Display the SVGs.
    svgs.forEach((svg, i) => {
      const page = document.createElement('div');
      page.setAttribute('id', `page-${i}`);
      page.innerHTML = svg;
      container.appendChild(page);

      // Scale the SVG to the container width.
      const s = page.getElementsByTagName('svg')[0];
      const w = s.getAttribute('width')?.replace('px', '');
      const h = s.getAttribute('height')?.replace('px', '');
      s.setAttribute('viewBox', `0 0 ${w} ${h}`);
      s.setAttribute('width', '100%');
      s.removeAttribute('height');
    });

    // Set up event listeners on notes and cached information for cursor movement.
    assertIsDefined(this._events);
    this._events.forEach((event, eventEntry) => {
      // On new measure, save the measure information.
      if ('measureOn' in event) {
        const measure = document.getElementById(event.measureOn)!;
        const system = measure.closest('g.system')!;
        this._measures.push({
          measure: this._measures.length,
          timestamp: event.tstamp,
          duration: 0, // Don't care about the duration for this renderer
          eventEntry,
          rectMeasure: measure.getBoundingClientRect(),
          rectSystem: system.getBoundingClientRect(),
        });
      }

      // Carry over the previously sounding notes and remove the ending notes.
      event.notesOn = eventEntry > 0 ? structuredClone(this._events![eventEntry-1].notesOn) : [];
      const notesOff = [...(event.off ?? []), ...(event.restsOff ?? [])];
      event.notesOn = event.notesOn.filter(n => !notesOff.includes(n));

      // Set up an event listener for each new note/rest.
      // Add each new note to the list of sounding notes.
      const measure = this._measures.last();
      [...(event.on ?? []), ...(event.restsOn ?? [])].forEach((domid) => {
        const note = document.getElementById(domid)!;
        note.addEventListener('click', () => {
          this.player?.moveTo(measure.measure, measure.timestamp, event.tstamp - measure.timestamp);
        });
        event.rectNotes.push(note.getBoundingClientRect());
        event.notesOn.push(domid);
      });

      // Ensure at least one rectNote exists.
      if (!event.rectNotes.length) {
        event.rectNotes.push(measure.rectMeasure);
      }

      // Special case: If this is the first note, set the measure's bounding rect to start here
      // in order to avoid objects such as time signature and key signature.
      if (eventEntry === 0) {
        measure.rectMeasure.width -= event.rectNotes[0].left - measure.rectMeasure.left;
        measure.rectMeasure.x = event.rectNotes[0].x;
      }
    });

    // Initialize the cursor.
    this._cursor.initialize(container);
    this.moveTo(0, 0, 0);
  }

  moveTo(
    index: MeasureIndex,
    start: MillisecsTimestamp,
    offset: MillisecsTimestamp,
    duration?: MillisecsTimestamp,
  ): void {
    // Find event entry that corresponds to current position.
    // Start searching at the incoming measure and find the subsequent event entry with matching timestamp.
    assertIsDefined(this._events);
    let eventEntry = this._measures[index].eventEntry;
    while (eventEntry < this._events.length - 1 && this._events[eventEntry + 1].tstamp <= start + offset) {
      eventEntry++;
    }

    // Restore the deactivated notes to their previous attributes.
    // Highlight the activated notes and save their attributes.
    if (this._currentEventEntry !== eventEntry) {
      const notesOn = this._events[eventEntry].notesOn;
      const notesOff = this._currentNotes.filter((note) => !notesOn.includes(note.domid));
      notesOff.forEach((note) => {
        const element = document.getElementById(note.domid);
        if (note.fill) element?.setAttribute('fill', note.fill); else element?.removeAttribute('fill');
        if (note.stroke) element?.setAttribute('stroke', note.stroke); else element?.removeAttribute('stroke');
      });
      this._currentNotes = this._currentNotes.filter((note) => notesOn.includes(note.domid));
      notesOn.forEach(domid => {
        const element = document.getElementById(domid);
        if (!this._currentNotes.find((note) => note.domid === domid)) {
          this._currentNotes.push({ domid, fill: element?.getAttribute('fill') ?? null, stroke: element?.getAttribute('stroke') ?? null });
        }
        element?.setAttribute('fill', 'rgb(234, 107, 36)');
        element?.setAttribute('stroke', 'rgb(234, 107, 36)');
      });
      this._currentEventEntry = eventEntry;
    }

    // Calculate cursor position.
    const rectMeasure = this._measures[index].rectMeasure;
    const rectSystem = this._measures[index].rectSystem;
    const rectNote = this._events[eventEntry].rectNotes[0]; // guaranteed to have at least one
    this._cursor.moveTo(
      duration
        ? rectMeasure.left + Math.round(Math.min(1.0, offset / duration) * rectMeasure.width)
        : rectNote.left,
      rectSystem.top,
      rectSystem.height
    );
  }

  resize(): void {
    console.log('resize');
  }

  get version(): string {
    return `${pkg.name} v${pkg.version}`;
  }
}
