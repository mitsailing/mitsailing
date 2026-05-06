export const adminRichTextToolbarItems = [
  'heading',
  '|',
  'bold',
  'italic',
  'link',
  'bulletedList',
  'numberedList',
  'blockQuote',
  'codeBlock',
  '|',
  'uploadImage',
  'adminMediaLibrary',
  '|',
  'undo',
  'redo',
] as const;

export const adminRichTextDefaultImageStyle = 'alignRight';

export const adminRichTextImageToolbarItems = [
  'imageTextAlternative',
  'toggleImageCaption',
  'linkImage',
  '|',
  {
    name: 'imageStyle:wrapText',
    title: 'Wrap text',
    items: ['imageStyle:alignLeft', 'imageStyle:alignRight'],
    defaultItem: 'imageStyle:alignRight',
  },
  {
    name: 'imageStyle:breakText',
    title: 'Break text',
    items: ['imageStyle:block', 'imageStyle:alignCenter'],
    defaultItem: 'imageStyle:block',
  },
  '|',
  'resizeImage',
] as const;

export const adminRichTextImageStyleOptions = [
  'alignLeft',
  'alignRight',
  'alignCenter',
  'alignBlockLeft',
  'alignBlockRight',
  'block',
  'side',
] as const;

export const adminRichTextImageResizeOptions = [
  {
    name: 'resizeImage:original',
    value: null,
    label: 'Original size',
  },
  {
    name: 'resizeImage:25',
    value: '25',
    label: 'Small',
  },
  {
    name: 'resizeImage:50',
    value: '50',
    label: 'Medium',
  },
  {
    name: 'resizeImage:75',
    value: '75',
    label: 'Large',
  },
  {
    name: 'resizeImage:100',
    value: '100',
    label: 'Full width',
  },
] as const;
