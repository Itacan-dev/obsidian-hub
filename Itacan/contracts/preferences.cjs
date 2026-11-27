const defaults = {
  theme:'system', accent:'Forest', textSize:'Standard', density:'Comfortable', motion:'System',
  readingWidth:'Standard', editorMode:'read', saveMode:'auto'
};
const choices = {
  theme:['system','light','dark'], accent:['Forest','Blue','Plum','Amber'],
  textSize:['Standard','Large','Extra large'], density:['Comfortable','Compact'],
  motion:['System','Reduced'], readingWidth:['Standard','Wide','Narrow'],
  editorMode:['live','source','read'], saveMode:['auto','manual']
};
const shortcuts = {
  quickAdd:['Quick Add','Mod+Shift+Space'], save:['Save document','Mod+S'],
  closeTab:['Close tab','Mod+W'], nextTab:['Next tab','Ctrl+Tab'],
  previousTab:['Previous tab','Ctrl+Shift+Tab'], settings:['Open settings','Mod+,']
};
const periods = ['Morning','Afternoon','Evening','Night'];
const coverArt = ['horizon','project','knowledge','research','explorations','inspiration'];
module.exports = { defaults, choices, shortcuts, periods, coverArt };
