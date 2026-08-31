// avatars.js - Collection of cute & funny vector SVG character avatars for players
(function (window) {
  const AVATARS = [
    {
      id: 'cyber_bot',
      name: 'Cyber Bot',
      bg: '#3B82F6',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#1E293B"/>
          <circle cx="32" cy="14" r="4" fill="#60A5FA"/>
          <line x1="32" y1="18" x2="32" y2="24" stroke="#94A3B8" stroke-width="3"/>
          <rect x="16" y="24" width="32" height="26" rx="8" fill="#3B82F6"/>
          <rect x="22" y="30" width="8" height="6" rx="3" fill="#93C5FD"/>
          <rect x="34" y="30" width="8" height="6" rx="3" fill="#93C5FD"/>
          <circle cx="26" cy="33" r="1.5" fill="#1E3A8A"/>
          <circle cx="38" cy="33" r="1.5" fill="#1E3A8A"/>
          <rect x="26" y="41" width="12" height="3" rx="1.5" fill="#1E3A8A"/>
          <rect x="12" y="32" width="4" height="8" rx="2" fill="#94A3B8"/>
          <rect x="48" y="32" width="4" height="8" rx="2" fill="#94A3B8"/>
        </svg>`
    },
    {
      id: 'astro_cat',
      name: 'Astro Cat',
      bg: '#EC4899',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#31102A"/>
          <polygon points="20,16 28,30 16,30" fill="#F472B6"/>
          <polygon points="44,16 48,30 36,30" fill="#F472B6"/>
          <polygon points="21,20 26,28 18,28" fill="#FDF2F8"/>
          <polygon points="43,20 46,28 38,28" fill="#FDF2F8"/>
          <circle cx="32" cy="36" r="18" fill="#F472B6"/>
          <ellipse cx="25" cy="34" rx="3.5" ry="4.5" fill="#1E1B4B"/>
          <ellipse cx="39" cy="34" rx="3.5" ry="4.5" fill="#1E1B4B"/>
          <circle cx="26" cy="33" r="1.2" fill="#FFFFFF"/>
          <circle cx="40" cy="33" r="1.2" fill="#FFFFFF"/>
          <polygon points="32,40 30,38 34,38" fill="#BE185D"/>
          <path d="M30 42 Q32 44 34 42" stroke="#BE185D" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        </svg>`
    },
    {
      id: 'chill_dino',
      name: 'Chill Dino',
      bg: '#10B981',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#064E3B"/>
          <circle cx="18" cy="22" r="3" fill="#059669"/>
          <circle cx="24" cy="18" r="3.5" fill="#059669"/>
          <circle cx="32" cy="16" r="3" fill="#059669"/>
          <rect x="18" y="22" width="28" height="28" rx="12" fill="#10B981"/>
          <!-- Cool sunglasses -->
          <rect x="20" y="28" width="11" height="8" rx="3" fill="#111827"/>
          <rect x="33" y="28" width="11" height="8" rx="3" fill="#111827"/>
          <line x1="31" y1="31" x2="33" y2="31" stroke="#111827" stroke-width="2"/>
          <line x1="22" y1="30" x2="28" y2="34" stroke="#6EE7B7" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M26 43 Q32 46 38 43" stroke="#047857" stroke-width="2" fill="none" stroke-linecap="round"/>
          <circle cx="24" cy="40" r="2" fill="#34D399"/>
          <circle cx="40" cy="40" r="2" fill="#34D399"/>
        </svg>`
    },
    {
      id: 'party_penguin',
      name: 'Party Penguin',
      bg: '#6366F1',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#1E1B4B"/>
          <!-- Party hat -->
          <polygon points="32,10 24,24 40,24" fill="#F59E0B"/>
          <circle cx="32" cy="10" r="2.5" fill="#EC4899"/>
          <!-- Body -->
          <ellipse cx="32" cy="38" rx="16" ry="18" fill="#1E293B"/>
          <ellipse cx="32" cy="40" rx="11" ry="14" fill="#F8FAFC"/>
          <!-- Eyes & Beak -->
          <circle cx="27" cy="34" r="2.5" fill="#0F172A"/>
          <circle cx="37" cy="34" r="2.5" fill="#0F172A"/>
          <polygon points="32,38 29,42 35,42" fill="#F97316"/>
          <!-- Blush -->
          <circle cx="23" cy="38" r="2" fill="#FDA4AF"/>
          <circle cx="41" cy="38" r="2" fill="#FDA4AF"/>
        </svg>`
    },
    {
      id: 'ninja_fox',
      name: 'Ninja Fox',
      bg: '#F97316',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#431407"/>
          <!-- Ears -->
          <polygon points="18,14 28,26 14,26" fill="#EA580C"/>
          <polygon points="46,14 50,26 36,26" fill="#EA580C"/>
          <polygon points="20,18 26,24 16,24" fill="#1E293B"/>
          <polygon points="44,18 48,24 38,24" fill="#1E293B"/>
          <!-- Head -->
          <ellipse cx="32" cy="36" rx="17" ry="16" fill="#F97316"/>
          <polygon points="32,50 20,38 44,38" fill="#FFF7ED"/>
          <!-- Headband -->
          <rect x="15" y="28" width="34" height="6" fill="#0F172A"/>
          <rect x="29" y="29" width="6" height="4" rx="1" fill="#E2E8F0"/>
          <!-- Eyes -->
          <path d="M22 36 L28 36" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M36 36 L42 36" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="32" cy="44" r="2" fill="#0F172A"/>
        </svg>`
    },
    {
      id: 'cosmic_bear',
      name: 'Cosmic Bear',
      bg: '#8B5CF6',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#2E1065"/>
          <!-- Ears -->
          <circle cx="20" cy="22" r="7" fill="#8B5CF6"/>
          <circle cx="44" cy="22" r="7" fill="#8B5CF6"/>
          <circle cx="20" cy="22" r="4" fill="#DDD6FE"/>
          <circle cx="44" cy="22" r="4" fill="#DDD6FE"/>
          <!-- Head -->
          <circle cx="32" cy="36" r="17" fill="#A78BFA"/>
          <ellipse cx="32" cy="40" rx="9" ry="7" fill="#EDE9FE"/>
          <!-- Eyes & Nose -->
          <circle cx="26" cy="33" r="2.5" fill="#1E1B4B"/>
          <circle cx="38" cy="33" r="2.5" fill="#1E1B4B"/>
          <circle cx="27" cy="32" r="1" fill="#FFFFFF"/>
          <circle cx="39" cy="32" r="1" fill="#FFFFFF"/>
          <ellipse cx="32" cy="39" rx="3" ry="2" fill="#4C1D95"/>
          <path d="M30 42 Q32 44 34 42" stroke="#4C1D95" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        </svg>`
    },
    {
      id: 'space_alien',
      name: 'Space Alien',
      bg: '#14B8A6',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#042F2E"/>
          <!-- Antenna -->
          <line x1="32" y1="12" x2="32" y2="22" stroke="#2DD4BF" stroke-width="3"/>
          <circle cx="32" cy="11" r="4" fill="#A7F3D0"/>
          <!-- Head -->
          <ellipse cx="32" cy="36" rx="18" ry="15" fill="#2DD4BF"/>
          <!-- Big 3 Eyes -->
          <circle cx="24" cy="32" r="4" fill="#FFFFFF"/>
          <circle cx="32" cy="29" r="4.5" fill="#FFFFFF"/>
          <circle cx="40" cy="32" r="4" fill="#FFFFFF"/>
          <circle cx="24" cy="32" r="2" fill="#0F172A"/>
          <circle cx="32" cy="29" r="2.5" fill="#0F172A"/>
          <circle cx="40" cy="32" r="2" fill="#0F172A"/>
          <!-- Happy mouth -->
          <path d="M26 42 Q32 47 38 42" stroke="#0F766E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </svg>`
    },
    {
      id: 'magic_owl',
      name: 'Magic Owl',
      bg: '#F59E0B',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#451A03"/>
          <!-- Feather tufts -->
          <polygon points="18,18 24,26 14,26" fill="#D97706"/>
          <polygon points="46,18 50,26 40,26" fill="#D97706"/>
          <!-- Body -->
          <ellipse cx="32" cy="38" rx="17" ry="16" fill="#F59E0B"/>
          <!-- Giant cute spectacles -->
          <circle cx="24" cy="34" r="7" fill="#FEF3C7" stroke="#78350F" stroke-width="2"/>
          <circle cx="40" cy="34" r="7" fill="#FEF3C7" stroke="#78350F" stroke-width="2"/>
          <line x1="31" y1="34" x2="33" y2="34" stroke="#78350F" stroke-width="2"/>
          <circle cx="24" cy="34" r="3.5" fill="#78350F"/>
          <circle cx="40" cy="34" r="3.5" fill="#78350F"/>
          <circle cx="25" cy="33" r="1.2" fill="#FFFFFF"/>
          <circle cx="41" cy="33" r="1.2" fill="#FFFFFF"/>
          <polygon points="32,38 29,43 35,43" fill="#EA580C"/>
        </svg>`
    },
    {
      id: 'turbo_panda',
      name: 'Turbo Panda',
      bg: '#64748B',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#0F172A"/>
          <!-- Ears -->
          <circle cx="19" cy="21" r="6.5" fill="#1E293B"/>
          <circle cx="45" cy="21" r="6.5" fill="#1E293B"/>
          <!-- Head -->
          <circle cx="32" cy="36" r="17" fill="#F8FAFC"/>
          <!-- Eye patches -->
          <ellipse cx="24" cy="33" rx="5" ry="4" transform="rotate(-15 24 33)" fill="#1E293B"/>
          <ellipse cx="40" cy="33" rx="5" ry="4" transform="rotate(15 40 33)" fill="#1E293B"/>
          <circle cx="24" cy="33" r="2" fill="#F8FAFC"/>
          <circle cx="40" cy="33" r="2" fill="#F8FAFC"/>
          <circle cx="24" cy="33" r="1.2" fill="#0F172A"/>
          <circle cx="40" cy="33" r="1.2" fill="#0F172A"/>
          <!-- Nose & Smile -->
          <ellipse cx="32" cy="39" rx="2.5" ry="2" fill="#1E293B"/>
          <path d="M29 42 Q32 44 35 42" stroke="#1E293B" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        </svg>`
    },
    {
      id: 'cyber_bunny',
      name: 'Cyber Bunny',
      bg: '#06B6D4',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#164E63"/>
          <!-- Long Ears -->
          <rect x="22" y="10" width="6" height="18" rx="3" fill="#22D3EE"/>
          <rect x="36" y="10" width="6" height="18" rx="3" fill="#22D3EE"/>
          <rect x="23.5" y="12" width="3" height="12" rx="1.5" fill="#CFFAFE"/>
          <rect x="37.5" y="12" width="3" height="12" rx="1.5" fill="#CFFAFE"/>
          <!-- Head -->
          <circle cx="32" cy="38" r="16" fill="#22D3EE"/>
          <circle cx="26" cy="36" r="2.5" fill="#083344"/>
          <circle cx="38" cy="36" r="2.5" fill="#083344"/>
          <circle cx="27" cy="35" r="1" fill="#FFFFFF"/>
          <circle cx="39" cy="35" r="1" fill="#FFFFFF"/>
          <polygon points="32,41 30,39 34,39" fill="#083344"/>
          <path d="M29 43 Q32 45 35 43" stroke="#083344" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <circle cx="20" cy="40" r="2.5" fill="#A5F3FC"/>
          <circle cx="44" cy="40" r="2.5" fill="#A5F3FC"/>
        </svg>`
    },
    {
      id: 'happy_star',
      name: 'Happy Star',
      bg: '#EAB308',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#422006"/>
          <!-- Star Body -->
          <polygon points="32,12 37,25 51,26 40,36 43,50 32,42 21,50 24,36 13,26 27,25" fill="#FACC15"/>
          <!-- Cute Face -->
          <circle cx="28" cy="31" r="2" fill="#713F12"/>
          <circle cx="36" cy="31" r="2" fill="#713F12"/>
          <path d="M29 36 Q32 39 35 36" stroke="#713F12" stroke-width="2" fill="none" stroke-linecap="round"/>
          <circle cx="24" cy="34" r="1.5" fill="#FDE047"/>
          <circle cx="40" cy="34" r="1.5" fill="#FDE047"/>
        </svg>`
    },
    {
      id: 'galaxy_dog',
      name: 'Galaxy Dog',
      bg: '#D97706',
      svg: (s = 48) => `
        <svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="20" fill="#3B1E08"/>
          <!-- Floppy Ears -->
          <rect x="14" y="24" width="7" height="16" rx="3.5" fill="#B45309"/>
          <rect x="43" y="24" width="7" height="16" rx="3.5" fill="#B45309"/>
          <!-- Head -->
          <ellipse cx="32" cy="36" rx="16" ry="15" fill="#F59E0B"/>
          <ellipse cx="32" cy="40" rx="9" ry="7" fill="#FEF3C7"/>
          <!-- Eyes & Nose -->
          <circle cx="26" cy="33" r="2.5" fill="#1E293B"/>
          <circle cx="38" cy="33" r="2.5" fill="#1E293B"/>
          <circle cx="27" cy="32" r="1" fill="#FFFFFF"/>
          <circle cx="39" cy="32" r="1" fill="#FFFFFF"/>
          <ellipse cx="32" cy="38" rx="3.5" ry="2.5" fill="#451A03"/>
          <path d="M30 42 Q32 45 34 42" stroke="#451A03" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>`
    }
  ];

  const Avatars = {
    list() {
      return AVATARS;
    },

    get(id) {
      return AVATARS.find((a) => a.id === id) || AVATARS[0];
    },

    getRandom() {
      const idx = Math.floor(Math.random() * AVATARS.length);
      return AVATARS[idx].id;
    },

    getSvg(id, size = 48) {
      const a = this.get(id);
      return a.svg(size);
    }
  };

  window.Avatars = Avatars;
})(window);
