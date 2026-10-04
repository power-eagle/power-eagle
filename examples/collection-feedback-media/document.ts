import { defineDocument, feedback, ref, set } from '../../src/sdui/authoring';
import {
  DataTable, GridView, ListView, PropertyGrid, ReorderableList, ScrollView, TreeView, VirtualGrid, VirtualList,
} from '../../src/sdui/authoring/collections';
import { Button } from '../../src/sdui/authoring/desktop';
import { Banner, Dialog, EmptyState, ErrorState, ProgressIndicator, Skeleton, Toast } from '../../src/sdui/authoring/feedback';
import { Column } from '../../src/sdui/authoring/layout';
import { AudioPlayer, ImageGallery, VideoPlayer, ZoomableImage } from '../../src/sdui/authoring/media';
import { Text } from '../../src/sdui/authoring/content';

const state = <T>(name: string) => ref<T>('state', name);
const change = (name: string) => set(name, ref('event'));
const picture = (color: string) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='${color}'/%3E%3C/svg%3E`;

export default defineDocument({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], components: {}, actions: {},
  state: {
    listSelection: { schema: { type: 'array', items: { type: 'string' } }, initial: ['alpha'] },
    order: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    treeSelection: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    expanded: { schema: { type: 'array', items: { type: 'string' } }, initial: ['package'] },
    tableSelection: { schema: { type: 'array', items: { type: 'string' } }, initial: [] },
    sortColumn: { schema: { type: 'string' }, initial: 'rank' },
    sortDirection: { schema: { type: 'enum', values: ['ascending', 'descending'] }, initial: 'ascending' },
    propertyChange: { schema: { type: 'json' }, initial: null },
    gallerySelection: { schema: { type: 'string' }, initial: 'amber' },
    zoom: { schema: { type: 'number' }, initial: 1 },
    mediaEvent: { schema: { type: 'json' }, initial: null },
  },
  screens: {
    home: {
      params: { type: 'object', properties: {}, required: [] }, state: {},
      body: Column.node({ gap: 12, crossAxisAlignment: 'stretch' }, { slots: { children: [
        Text.node({ text: 'Collection, feedback, and media vocabulary', variant: 'title' }),
        ScrollView.node({ direction: 'horizontal', height: 52 }, { slots: { children: [
          Text.node({ text: 'Scrollable package activity' }), Text.node({ text: 'Provider ready' }),
        ] } }),
        ListView.node({ label: 'Packages', height: 88, selectionMode: 'single', selection: state<string[]>('listSelection') }, {
          events: { selectionChange: change('listSelection') }, slots: { children: [
            Text.node({ text: 'Alpha package' }, { key: 'alpha' }), Text.node({ text: 'Beta package' }, { key: 'beta' }),
          ], empty: Text.node({ text: 'No packages' }) },
        }),
        GridView.node({ label: 'Widget grid', height: 88, columns: 2, selectionMode: 'multiple', selection: [] }, { slots: { children: [
          Text.node({ text: 'Layout' }, { key: 'layout' }), Text.node({ text: 'Content' }, { key: 'content' }),
        ], empty: Text.node({ text: 'No widgets' }) } }),
        VirtualList.node({ label: 'Virtual package list', height: 72, itemExtent: 32, selectionMode: 'single', selection: [] }, { slots: { children: [
          Text.node({ text: 'Virtual alpha' }, { key: 'virtual-alpha' }), Text.node({ text: 'Virtual beta' }, { key: 'virtual-beta' }),
          Text.node({ text: 'Virtual gamma' }, { key: 'virtual-gamma' }), Text.node({ text: 'Virtual delta' }, { key: 'virtual-delta' }),
        ], empty: Text.node({ text: 'No virtual packages' }) } }),
        VirtualGrid.node({ label: 'Virtual widget grid', height: 72, columns: 2, rowExtent: 32, selectionMode: 'multiple', selection: [] }, { slots: { children: [
          Text.node({ text: 'One' }, { key: 'one' }), Text.node({ text: 'Two' }, { key: 'two' }),
          Text.node({ text: 'Three' }, { key: 'three' }), Text.node({ text: 'Four' }, { key: 'four' }),
        ], empty: Text.node({ text: 'No virtual widgets' }) } }),
        ReorderableList.node({ label: 'Activation order', height: 88, selectionMode: 'none', selection: [] }, {
          events: { reorder: change('order') }, slots: { children: [
            Text.node({ text: 'Runtime' }, { key: 'runtime' }), Text.node({ text: 'Styling' }, { key: 'styling' }),
          ], empty: Text.node({ text: 'No activation entries' }) },
        }),
        TreeView.node({
          label: 'Package tree', selectionMode: 'single', selection: state<string[]>('treeSelection'),
          expanded: state<string[]>('expanded'), items: [
            { id: 'package', label: 'Package' }, { id: 'runtime', label: 'Runtime', parentId: 'package' },
            { id: 'styles', label: 'Styles', parentId: 'package' },
          ],
        }, { events: { selectionChange: change('treeSelection'), expandedChange: change('expanded') } }),
        DataTable.node({
          label: 'Installed packages', rows: [
            { id: 'alpha', name: 'Alpha', rank: 2 }, { id: 'beta', name: 'Beta', rank: 1 },
          ], columns: [
            { key: 'name', label: 'Name', type: 'string', sortable: true },
            { key: 'rank', label: 'Rank', type: 'number', sortable: true, align: 'end' },
          ], rowKey: 'id', selectionMode: 'single', selection: state<string[]>('tableSelection'),
          sortColumn: state<string>('sortColumn'), sortDirection: state<'ascending' | 'descending'>('sortDirection'),
        }, { events: { selectionChange: change('tableSelection'), sortChange: set('mediaEvent', ref('event')) } }),
        PropertyGrid.node({ label: 'Package properties', columns: 2, items: [
          { id: 'name', label: 'Name', value: 'Power Eagle', editor: 'text', editable: true },
          { id: 'enabled', label: 'Enabled', value: true, editor: 'boolean', editable: true },
          { id: 'version', label: 'Version', value: '1.0.0' },
        ] }, { events: { change: change('propertyChange') } }),
        ProgressIndicator.node({ label: 'Installing package', status: '3 of 5 files', value: 60 }),
        Skeleton.node({ label: 'Loading package details', lines: 2 }),
        EmptyState.node({ title: 'No generated packages', message: 'Ask the Agent to create one.', actionLabel: 'Notify me' }, {
          events: { action: feedback('toast', 'notice', { message: 'Notification requested', tone: 'success' }) },
        }),
        ErrorState.node({ title: 'Source unavailable', message: 'The package source could not be reached.', retryLabel: 'Retry' }, {
          events: { retry: feedback('toast', 'notice', { message: 'Retry started', tone: 'info' }) },
        }),
        Banner.node({ title: 'Package ready', message: 'Review before activation.', tone: 'success', actionLabel: 'Review' }, {
          events: { action: feedback('openDialog', 'review', { title: 'Review package', description: 'The package is ready to activate.' }) },
        }),
        Toast.node({ id: 'notice', message: 'Package notification', duration: 0, open: false }),
        Dialog.node({ id: 'review', title: 'Review', description: '', open: false }, { slots: {
          children: [Text.node({ text: 'example.collection-feedback-media/main' })],
          actions: [Button.node({ label: 'Close review' }, { events: { press: feedback('closeDialog', 'review') } })],
        } }),
        ImageGallery.node({ label: 'Package images', selection: state<string>('gallerySelection'), columns: 2, items: [
          { id: 'amber', src: picture('%23ffae2b'), alt: 'Amber package preview', caption: 'Amber' },
          { id: 'blue', src: picture('%235e8cff'), alt: 'Blue package preview', caption: 'Blue' },
        ] }, { events: { selectionChange: change('gallerySelection'), error: change('mediaEvent') } }),
        ZoomableImage.node({ src: picture('%23ffae2b'), alt: 'Zoomable package preview', scale: state<number>('zoom') }, {
          events: { zoom: change('zoom'), error: change('mediaEvent') },
        }),
        AudioPlayer.node({ src: 'preview.mp3', label: 'Audio package preview', mimeType: 'audio/mpeg' }, {
          events: { timeUpdate: change('mediaEvent'), error: change('mediaEvent') },
        }),
        VideoPlayer.node({ src: 'preview.mp4', label: 'Video package preview', mimeType: 'video/mp4', width: 240, height: 135 }, {
          events: { timeUpdate: change('mediaEvent'), error: change('mediaEvent') },
        }),
      ] } }),
    },
  },
});
