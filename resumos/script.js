document.addEventListener('DOMContentLoaded', () => {
    // 1. Scroll Progress Bar
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress-bar';
    const progressContainer = document.createElement('div');
    progressContainer.className = 'scroll-progress-container';
    progressContainer.appendChild(progressBar);
    document.body.prepend(progressContainer);

    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressBar.style.width = scrolled + '%';
    });

    // 2. Intersection Observer for Scroll Animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: stop observing once visible
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Apply animation classes to elements
    const elementsToAnimate = document.querySelectorAll('.card, .content-section, .info-card, .highlight-box');
    elementsToAnimate.forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });

    // 3. Dynamic Table of Contents (only if page has .content-section)
    const contentSections = document.querySelectorAll('.content-section h2');
    if (contentSections.length > 0) {
        document.body.classList.add('has-sidebar');
        
        // Wrap .container in .main-wrapper
        const container = document.querySelector('.container');
        if (container) {
            const wrapper = document.createElement('div');
            wrapper.className = 'main-wrapper';
            container.parentNode.insertBefore(wrapper, container);
            wrapper.appendChild(container);

            // Create Sidebar
            const sidebar = document.createElement('aside');
            sidebar.className = 'toc-sidebar';
            
            const tocTitle = document.createElement('div');
            tocTitle.className = 'toc-title';
            tocTitle.innerHTML = '<i class="fas fa-list-ul"></i> Neste Resumo';
            sidebar.appendChild(tocTitle);

            const tocList = document.createElement('ul');
            tocList.className = 'toc-list';
            
            contentSections.forEach((h2, index) => {
                // Ensure ID exists
                if (!h2.id) {
                    h2.id = 'section-' + index;
                }
                
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#' + h2.id;
                // remove icons from innerText if any
                a.innerText = h2.innerText.trim();
                
                // Smooth scroll
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelector(a.getAttribute('href')).scrollIntoView({
                        behavior: 'smooth'
                    });
                    // close mobile modal if open
                    if (mobileModal.classList.contains('open')) {
                        mobileModal.classList.remove('open');
                    }
                });
                
                li.appendChild(a);
                tocList.appendChild(li);
            });
            
            sidebar.appendChild(tocList);
            wrapper.appendChild(sidebar);

            // Mobile TOC Button & Modal
            const mobileBtn = document.createElement('button');
            mobileBtn.className = 'mobile-toc-btn';
            mobileBtn.innerHTML = '<i class="fas fa-list-ul"></i>';
            document.body.appendChild(mobileBtn);

            const mobileModal = document.createElement('div');
            mobileModal.className = 'mobile-toc-modal';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-toc';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            
            mobileModal.appendChild(closeBtn);
            
            // clone toc list for mobile
            const mobileTocList = tocList.cloneNode(true);
            
            // reattach events for mobile list
            mobileTocList.querySelectorAll('a').forEach(a => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelector(a.getAttribute('href')).scrollIntoView({
                        behavior: 'smooth'
                    });
                    mobileModal.classList.remove('open');
                });
            });

            mobileModal.appendChild(mobileTocList);
            document.body.appendChild(mobileModal);

            mobileBtn.addEventListener('click', () => {
                mobileModal.classList.add('open');
            });

            closeBtn.addEventListener('click', () => {
                mobileModal.classList.remove('open');
            });
            
            // Highlight active TOC item on scroll
            const sections = document.querySelectorAll('.content-section');
            window.addEventListener('scroll', () => {
                let current = '';
                sections.forEach(section => {
                    const sectionTop = section.offsetTop;
                    if (scrollY >= sectionTop - 150) {
                        const h2 = section.querySelector('h2');
                        if (h2) current = h2.getAttribute('id');
                    }
                });

                document.querySelectorAll('.toc-list a').forEach(a => {
                    a.classList.remove('active');
                    if (a.getAttribute('href') === '#' + current) {
                        a.classList.add('active');
                    }
                });
            });
        }
    }

    // 4. Accordion Logic (if any accordions are added)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.accordion-header')) {
            const header = e.target.closest('.accordion-header');
            const accordion = header.parentElement;
            const content = accordion.querySelector('.accordion-content');
            
            accordion.classList.toggle('active');
            
            if (accordion.classList.contains('active')) {
                content.style.maxHeight = content.scrollHeight + "px";
            } else {
                content.style.maxHeight = null;
            }
        }
    });
});
