import { useEffect } from 'react';

export default function usePageMeta({ title, description }) {
  useEffect(() => {
    const prev = document.title;
    if (title) document.title = `${title} | Tactile`;

    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.content;
    if (description) {
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = description;
    }

    return () => {
      document.title = prev;
      if (metaDesc && prevDesc) metaDesc.content = prevDesc;
    };
  }, [title, description]);
}
