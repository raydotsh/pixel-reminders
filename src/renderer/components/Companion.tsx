import React, { useState, useEffect } from 'react';
import girl_neutral from '../assets/girl_neutral.png';
import girl_happy from '../assets/girl_happy.png';
import girl_celebrate from '../assets/girl_celebrate.png';
import girl_sleepy from '../assets/girl_sleepy.png';
import girl_worried from '../assets/girl_worried.png';

import boy_neutral from '../assets/boy_neutral.png';
import boy_happy from '../assets/boy_happy.png';
import boy_celebrate from '../assets/boy_celebrate.png';
import boy_sleepy from '../assets/boy_sleepy.png';
import boy_worried from '../assets/boy_worried.png';

import cat_neutral from '../assets/cat_neutral.png';
import cat_happy from '../assets/cat_happy.png';
import cat_celebrate from '../assets/cat_celebrate.png';
import cat_sleepy from '../assets/cat_sleepy.png';
import cat_worried from '../assets/cat_worried.png';

export type CompanionExpression = 'neutral' | 'happy' | 'celebrate' | 'sleepy' | 'worried';

interface CompanionProps {
  expression: CompanionExpression;
  character?: 'girl' | 'boy' | 'cat';
  scale?: 'small' | 'medium' | 'large';
  animation?: 'idle' | 'wave' | 'jump' | 'none';
  className?: string;
  style?: React.CSSProperties;
}

const characterImages: Record<'girl' | 'boy' | 'cat', Record<CompanionExpression, string>> = {
  girl: {
    neutral: girl_neutral,
    happy: girl_happy,
    celebrate: girl_celebrate,
    sleepy: girl_sleepy,
    worried: girl_worried,
  },
  boy: {
    neutral: boy_neutral,
    happy: boy_happy,
    celebrate: boy_celebrate,
    sleepy: boy_sleepy,
    worried: boy_worried,
  },
  cat: {
    neutral: cat_neutral,
    happy: cat_happy,
    celebrate: cat_celebrate,
    sleepy: cat_sleepy,
    worried: cat_worried,
  },
};

const scaleSizes = {
  small: '64px',
  medium: '96px',
  large: '128px',
};

// Custom hook to dynamically remove white background pixels
function useTransparentImage(imgUrl: string) {
  const [src, setSrc] = useState(imgUrl);

  useEffect(() => {
    if (!imgUrl) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setSrc(imgUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        // Loop through pixels and clear white/near-white backgrounds
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          if (r > 240 && g > 240 && b > 240) {
            data[i+3] = 0; // Transparent alpha
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setSrc(canvas.toDataURL());
      } catch (err) {
        console.error('Failed to clear white background', err);
        setSrc(imgUrl);
      }
    };
    img.onerror = () => setSrc(imgUrl);
    img.src = imgUrl;
  }, [imgUrl]);

  return src;
}

export default function Companion({
  expression,
  character = 'girl',
  scale = 'medium',
  animation = 'idle',
  className = '',
  style = {},
}: CompanionProps) {
  const size = scaleSizes[scale];
  
  // Resolve animation classes
  let animClass = '';
  if (animation === 'idle') {
    animClass = 'animate-breathe';
  } else if (animation === 'wave') {
    animClass = 'animate-wave';
  } else if (animation === 'jump') {
    animClass = 'animate-jump';
  }

  // Fallback to neutral if expression doesn't exist
  const charSet = characterImages[character] || characterImages.girl;
  const imgSrc = charSet[expression] || charSet.neutral;
  const transparentSrc = useTransparentImage(imgSrc);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        ...style,
      }}
    >
      <img
        src={transparentSrc}
        alt={`Companion: ${character} ${expression}`}
        className={animClass}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}
