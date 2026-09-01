// icons.js - High-end vector SVG icons for enterprise UI
(function (window) {
  function svg(content, size = 18, className = 'icon') {
    return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">${content}</svg>`;
  }

  const Icons = {
    volumeOn: (s = 18) => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>', s),
    volumeMute: (s = 18) => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>', s),
    
    play: (s = 16) => svg('<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>', s),
    pause: (s = 16) => svg('<rect x="6" y="4" width="4" height="16" fill="currentColor"></rect><rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>', s),
    
    clock: (s = 16) => svg('<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>', s),
    plusTime: (s = 16) => svg('<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 15 12"></polyline><path d="M18 9v6m-3-3h6"></path>', s),
    
    image: (s = 16) => svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>', s),
    trash: (s = 14) => svg('<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>', s),
    
    zap: (s = 16) => svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"></polygon>', s),
    bolt: (s = 16) => svg('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"></path>', s),
    rocket: (s = 18) => svg('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>', s),
    
    lock: (s = 28) => svg('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>', s),
    flame: (s = 14) => svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="currentColor"></path>', s),
    
    trophy: (s = 28) => svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-2c-.55 0-1-.45-1-1v-2.34"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>', s),
    medal: (s = 24) => svg('<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>', s),
    
    check: (s = 16) => svg('<polyline points="20 6 9 17 4 12"></polyline>', s),
    cross: (s = 14) => svg('<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>', s),
    
    book: (s = 16) => svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>', s),
    chart: (s = 16) => svg('<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>', s),
    download: (s = 16) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', s),
    star: (s = 16) => svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"></polygon>', s),

    // Kahoot-style geometric vector shapes
    triangle: (s = 16) => svg('<polygon points="12 3 22 19 2 19" fill="currentColor"></polygon>', s),
    diamond: (s = 16) => svg('<polygon points="12 2 22 12 12 22 2 12" fill="currentColor"></polygon>', s),
    circle: (s = 16) => svg('<circle cx="12" cy="12" r="9" fill="currentColor"></circle>', s),
    square: (s = 16) => svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="currentColor"></rect>', s),

    arrowUp: (s = 14) => svg('<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>', s),
    arrowDown: (s = 14) => svg('<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>', s),
    arrowRight: (s = 14) => svg('<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>', s),

    crown: (s = 18) => svg('<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" fill="currentColor"></path><circle cx="12" cy="3" r="1.5" fill="currentColor"></circle>', s),
    disk: (s = 16) => svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>', s),
    upload: (s = 16) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>', s),

    edit: (s = 14) => svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>', s),
    copy: (s = 14) => svg('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>', s),
    folder: (s = 16) => svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>', s),
    fileText: (s = 16) => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>', s),

    grid: (s = 16) => svg('<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>', s),
    gear: (s = 16) => svg('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>', s),
    search: (s = 16) => svg('<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>', s),
    plus: (s = 16) => svg('<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>', s),
    history: (s = 16) => svg('<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>', s),
    users: (s = 16) => svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>', s),
    layers: (s = 16) => svg('<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>', s),

    shape: (index, s = 16) => {
      const shapes = [Icons.triangle, Icons.diamond, Icons.circle, Icons.square];
      return (shapes[index % 4] || shapes[0])(s);
    }
  };

  window.Icons = Icons;
})(window);
