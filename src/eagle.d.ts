type EagleIconColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'purple'
  | 'pink';

type EagleTheme =
  | 'Auto'
  | 'LIGHT'
  | 'LIGHTGRAY'
  | 'GRAY'
  | 'DARK'
  | 'BLUE'
  | 'PURPLE';

type ItemShape =
  | 'square'
  | 'portrait'
  | 'panoramic-portrait'
  | 'landscape'
  | 'panoramic-landscape';

type DialogOpenProperty =
  | 'openFile'
  | 'openDirectory'
  | 'multiSelections'
  | 'showHiddenFiles'
  | 'createDirectory'
  | 'promptToCreate';

type DialogSaveProperty =
  | 'openDirectory'
  | 'showHiddenFiles'
  | 'createDirectory';

type SmartFolderMatch = 'AND' | 'OR';
type SmartFolderBoolean = 'TRUE' | 'FALSE';
type SmartFolderRuleValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>;

declare global {
  const eagle: {
    onPluginCreate(callback: (plugin: PluginContext) => void): void;
    onPluginRun(callback: () => void): void;
    onPluginBeforeExit(callback: () => void): void;
    onPluginShow(callback: () => void): void;
    onPluginHide(callback: () => void): void;
    onLibraryChanged(callback: (libraryPath: string) => void): void;
    onThemeChanged(callback: (theme: EagleTheme) => void): void;

    tag: {
      get(options?: { name?: string }): Promise<Tag[]>;
      getRecentTags(): Promise<Tag[]>;
      getStarredTags(): Promise<Tag[]>;
      merge(options: {
        source: string;
        target: string;
      }): Promise<{
        affectedItems: number;
        sourceRemoved: boolean;
      }>;
    };

    tagGroup: {
      get(): Promise<TagGroup[]>;
      create(options: {
        name: string;
        tags: string[];
        color?: EagleIconColor;
        description?: string;
      }): Promise<TagGroup>;
    };

    library: {
      info(): Promise<LibraryInfo>;
      readonly name: string;
      readonly path: string;
      readonly modificationTime: number;
    };

    window: {
      show(): Promise<void>;
      showInactive(): Promise<void>;
      hide(): Promise<void>;
      focus(): Promise<void>;
      minimize(): Promise<void>;
      isMinimized(): Promise<boolean>;
      restore(): Promise<void>;
      maximize(): Promise<void>;
      unmaximize(): Promise<void>;
      isMaximized(): Promise<boolean>;
      setFullScreen(flag: boolean): Promise<void>;
      isFullScreen(): Promise<boolean>;
      setAspectRatio(aspectRatio: number): Promise<void>;
      setBackgroundColor(backgroundColor: string): Promise<void>;
      setSize(width: number, height: number): Promise<void>;
      getSize(): Promise<[number, number]>;
      setBounds(bounds: Rectangle): Promise<void>;
      getBounds(): Promise<Rectangle>;
      setResizable(resizable: boolean): Promise<void>;
      isResizable(): Promise<boolean>;
      setAlwaysOnTop(flag: boolean): Promise<void>;
      isAlwaysOnTop(): Promise<boolean>;
      setPosition(x: number, y: number): Promise<void>;
      getPosition(): Promise<[number, number]>;
      setOpacity(opacity: number): Promise<void>;
      getOpacity(): Promise<number>;
      flashFrame(flag: boolean): Promise<void>;
      setIgnoreMouseEvents(ignore: boolean): Promise<void>;
      capturePage(rect?: Rectangle): Promise<NativeImage>;
      setReferer(url: string): void;
    };

    app: {
      isDarkColors(): boolean;
      getPath(name: AppPath): Promise<string>;
      getFileIcon(
        path: string,
        options?: { size: 'small' | 'normal' | 'large' }
      ): Promise<NativeImage>;
      createThumbnailFromPath(
        path: string,
        maxSize: Size
      ): Promise<NativeImage>;
      readonly version: string;
      readonly build: number;
      readonly locale:
        | 'en'
        | 'zh_CN'
        | 'zh_TW'
        | 'ja_JP'
        | 'ko_KR'
        | 'es_ES'
        | 'de_DE'
        | 'ru_RU';
      readonly arch: 'x64' | 'arm64' | 'x86';
      readonly platform: 'darwin' | 'win32';
      readonly env: Record<string, string>;
      readonly execPath: string;
      readonly pid: number;
      readonly isWindows: boolean;
      readonly isMac: boolean;
      readonly runningUnderARM64Translation: boolean;
      readonly theme: Exclude<EagleTheme, 'Auto'>;
    };

    os: {
      tmpdir(): string;
      version(): string;
      type(): 'Windows_NT' | 'Darwin';
      release(): string;
      hostname(): string;
      homedir(): string;
      arch(): 'x64' | 'arm64' | 'x86';
    };

    screen: {
      getCursorScreenPoint(): Promise<Point>;
      getPrimaryDisplay(): Promise<Display>;
      getAllDisplays(): Promise<Display[]>;
      getDisplayNearestPoint(point: Point): Promise<Display>;
    };

    notification: {
      show(options: {
        title: string;
        body: string;
        icon?: string;
        mute?: boolean;
        duration?: number;
      }): Promise<void>;
    };

    item: {
      get(options?: ItemQueryOptions): Promise<Item[]>;
      getAll(): Promise<Item[]>;
      getById(itemId: string): Promise<Item>;
      getByIds(itemIds: string[]): Promise<Item[]>;
      getSelected(): Promise<Item[]>;
      getIdsWithModifiedAt(): Promise<Array<{ id: string; modifiedAt: number }>>;
      count(options: ItemQueryOptions): Promise<number>;
      countAll(): Promise<number>;
      countSelected(): Promise<number>;
      select(itemIds: string[]): Promise<boolean>;
      addFromURL(url: string, options?: ItemAddOptions): Promise<string>;
      addFromBase64(base64: string, options?: ItemAddOptions): Promise<string>;
      addFromPath(path: string, options?: ItemAddOptions): Promise<string>;
      addBookmark(
        url: string,
        options?: ItemBookmarkOptions
      ): Promise<string>;
      open(itemId: string, options?: { window?: boolean }): Promise<boolean>;
    };

    folder: {
      readonly IconColor: EagleIconColorMap;
      create(options: {
        name: string;
        description?: string;
        parent?: string;
      }): Promise<Folder>;
      createSubfolder(
        parentId: string,
        options: {
          name: string;
          description?: string;
        }
      ): Promise<Folder>;
      get(options?: {
        id?: string;
        ids?: string[];
        isSelected?: boolean;
        isRecent?: boolean;
      }): Promise<Folder[]>;
      getAll(): Promise<Folder[]>;
      getById(folderId: string): Promise<Folder>;
      getByIds(folderIds: string[]): Promise<Folder[]>;
      getSelected(): Promise<Folder[]>;
      getRecents(): Promise<Folder[]>;
      open(folderId: string): Promise<void>;
    };

    smartFolder: {
      readonly IconColor: EagleIconColorMap;
      readonly Rule: {
        new (
          property: string,
          method: string,
          value?: SmartFolderRuleValue
        ): SmartFolderRule;
      };
      readonly Condition: {
        create(
          match: SmartFolderMatch,
          rules: SmartFolderRule[],
          boolean?: SmartFolderBoolean
        ): SmartFolderCondition;
      };
      create(options: {
        name: string;
        conditions: SmartFolderCondition[];
        description?: string;
        iconColor?: EagleIconColor;
        parent?: string;
      }): Promise<SmartFolder>;
      get(options?: { id?: string; ids?: string[] }): Promise<SmartFolder[]>;
      getAll(): Promise<SmartFolder[]>;
      getById(smartFolderId: string): Promise<SmartFolder>;
      getByIds(smartFolderIds: string[]): Promise<SmartFolder[]>;
      remove(smartFolderId: string): Promise<boolean>;
      getRules(): Promise<Record<string, SmartFolderRuleSchema>>;
      rule(
        property: string
      ): Record<string, (value?: SmartFolderRuleValue) => SmartFolderRule>;
    };

    contextMenu: {
      open(menuItems: MenuItem[]): Promise<void>;
    };

    dialog: {
      showOpenDialog(options: {
        title?: string;
        defaultPath?: string;
        buttonLabel?: string;
        filters?: FileFilter[];
        properties?: DialogOpenProperty[];
        message?: string;
      }): Promise<{
        canceled: boolean;
        filePaths: string[];
      }>;
      showSaveDialog(options: {
        title?: string;
        defaultPath?: string;
        buttonLabel?: string;
        filters?: FileFilter[];
        properties?: DialogSaveProperty[];
      }): Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
      showMessageBox(options: {
        message: string;
        title?: string;
        detail?: string;
        buttons?: string[];
        type?: 'none' | 'info' | 'error' | 'question' | 'warning';
      }): Promise<{
        response: number;
      }>;
      showErrorBox(title: string, content: string): Promise<void>;
    };

    clipboard: {
      clear(): void;
      has(format: string): boolean;
      writeText(text: string): void;
      readText(): string;
      writeBuffer(format: string, buffer: Buffer): void;
      readBuffer(format: string): Buffer;
      writeImage(image: NativeImage): void;
      readImage(): NativeImage;
      writeHTML(markup: string): void;
      readHTML(): string;
      copyFiles(paths: string[]): void;
    };

    drag: {
      startDrag(filePaths: string[]): Promise<void>;
    };

    shell: {
      beep(): Promise<void>;
      openExternal(url: string): Promise<void>;
      openPath(path: string): Promise<void>;
      showItemInFolder(path: string): Promise<void>;
    };

    log: {
      info(message: string): void;
      warn(message: string): void;
      error(message: string): void;
      debug(message: string): void;
    };
  };

  interface Item {
    save(): Promise<boolean>;
    moveToTrash(): Promise<boolean>;
    replaceFile(filePath: string): Promise<boolean>;
    refreshThumbnail(): Promise<boolean>;
    setCustomThumbnail(thumbnailPath: string): Promise<boolean>;
    addComment(commentData: ItemCommentInput): Promise<ItemComment>;
    updateComment(
      commentId: string,
      updateData: ItemCommentUpdate
    ): Promise<ItemComment>;
    removeComment(commentId: string): Promise<boolean>;
    open(options?: { window?: boolean }): Promise<void>;
    select(): Promise<boolean>;

    readonly id: string;
    name: string;
    readonly ext: string;
    width: number;
    height: number;
    url: string;
    readonly isDeleted: boolean;
    annotation: string;
    tags: string[];
    folders: string[];
    readonly palettes: object[];
    readonly comments: ItemComment[];
    readonly size: number;
    star: number;
    importedAt: number;
    readonly modifiedAt: number;
    readonly noThumbnail: boolean;
    readonly noPreview: boolean;
    readonly filePath: string;
    readonly fileURL: string;
    readonly thumbnailPath: string;
    readonly thumbnailURL: string;
    readonly metadataFilePath: string;
  }

  interface Folder {
    save(): Promise<void>;
    open(): Promise<void>;

    readonly id: string;
    name: string;
    description: string;
    readonly icon: string;
    iconColor: EagleIconColor;
    readonly createdAt: number;
    parent: string | null;
    readonly children: Folder[];
  }

  interface TagGroup {
    save(): Promise<TagGroup>;
    remove(): Promise<boolean>;
    addTags(options: {
      tags: string[];
      removeFromSource?: boolean;
    }): Promise<TagGroup>;
    removeTags(options: { tags: string[] }): Promise<TagGroup>;

    name: string;
    color: EagleIconColor | '';
    description: string;
    tags: string[];
  }

  interface SmartFolder {
    save(): Promise<SmartFolder>;
    getItems(options?: {
      orderBy?: string;
      fields?: string[];
    }): Promise<Item[]>;

    readonly id: string;
    name: string;
    conditions: SmartFolderCondition[];
    description: string;
    readonly icon: string;
    iconColor: EagleIconColor;
    readonly modificationTime: number;
    readonly children: SmartFolder[];
    readonly parent: string;
    readonly imageCount: number;
  }
}

interface Tag {
  save(): Promise<boolean>;
  name: string;
  readonly count: number;
  color: string;
  readonly groups: string[];
  readonly pinyin: string;
}

interface PluginContext {
  manifest: PluginManifest;
  path: string;
}

interface PluginManifest {
  id?: string;
  version?: string;
  name?: string;
  logo?: string;
}

interface ItemQueryOptions {
  id?: string;
  ids?: string[];
  isSelected?: boolean;
  isUntagged?: boolean;
  isUnfiled?: boolean;
  keywords?: string[];
  tags?: string[];
  folders?: string[];
  ext?: string;
  annotation?: string;
  rating?: number;
  url?: string;
  shape?: ItemShape;
  fields?: string[];
}

interface ItemAddOptions {
  name?: string;
  website?: string;
  tags?: string[];
  folders?: string[];
  annotation?: string;
}

interface ItemBookmarkOptions {
  name?: string;
  base64?: string;
  tags?: string[];
  folders?: string[];
  annotation?: string;
}

interface ItemCommentInput {
  annotation?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface ItemCommentUpdate {
  annotation?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface ItemComment {
  id: string;
  annotation?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  duration?: number;
  lastModified?: number;
}

interface SmartFolderCondition {
  match: SmartFolderMatch;
  rules: SmartFolderRule[];
  boolean?: SmartFolderBoolean;
}

interface SmartFolderRule {
  property: string;
  method: string;
  value?: SmartFolderRuleValue;
}

interface SmartFolderRuleSchema {
  methods: string[];
  valueType: string;
  options?: Array<string | number | boolean>;
}

interface MenuItem {
  id: string;
  label: string;
  enabled?: boolean;
  submenu?: MenuItem[];
  click?: () => void;
}

interface FileFilter {
  name: string;
  extensions: string[];
}

interface LibraryInfo {
  name?: string;
  path?: string;
  modificationTime?: number;
  applicationVersion?: string;
  folders?: Folder[];
  smartFolders?: SmartFolder[];
  quickAccess?: object[];
  tagGroups?: TagGroup[];
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface Display {}

interface NativeImage {
  toDataURL(type: string): string;
  toPNG(): Buffer;
  getSize(): Size;
}

interface EagleIconColorMap {
  readonly Red: 'red';
  readonly Orange: 'orange';
  readonly Yellow: 'yellow';
  readonly Green: 'green';
  readonly Aqua: 'aqua';
  readonly Blue: 'blue';
  readonly Purple: 'purple';
  readonly Pink: 'pink';
}

type AppPath =
  | 'home'
  | 'appData'
  | 'userData'
  | 'temp'
  | 'exe'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'
  | 'recent';

export {};
