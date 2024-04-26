import { useContext, useEffect, useState } from 'react'
import './pagination.css'
import Icon from '../icon/Icon'
import { MainContext } from '../../context';
import { TldrawApp } from '@tldraw/tldraw';
import { INDEX, setIndex, storeConf } from '../../utils/constants';
import { v4 } from 'uuid';

const index = () => {
    const [showDropdown, setShowDropdown] = useState<boolean>(false);
    const { config, pages, setPages, page, setPage, loading, plugin, app } = useContext(MainContext);

    const addPage = async () => {
        setIndex(INDEX + 1);
        const pageObject = {
            name: `Page ${INDEX}`,
            id: v4(),
        };

        // create new page to dyte stores
        const PageStore = plugin.stores.get('page');
        await PageStore.bulkSet([
            { key: 'currentPage', payload: pageObject },
            { key: pageObject.id, payload: pageObject.name },
        ])

        // create new page state
        setPages((p: any) => [...p, pageObject]);
        setPage(pageObject);

        // create new page in tldraw
        (app as TldrawApp).createPage(pageObject.id, pageObject.name);
        setShowDropdown((d) => !d);
    }
    const deletePage = (id: string) => {
        // delete page from tldraw
        app.deletePage(id);
        const pageId = app.appState.currentPageId;
        const { name } = (app as TldrawApp).document.pages[pageId];

        // update page state
        setPages((p: any) => p.filter((x: any) => x.id !== id));
        setPage({ name, id: pageId });

        // delete page from dyte stores
        const PageStore = plugin.stores.get('page');
        PageStore.delete(id);
        PageStore.set('currentPage', { name, id: pageId });
        setShowDropdown((d) => !d);
    }
    const switchPage = (pageObject: { name: string; id: string }) => {
        // change page state
        setPage(pageObject);
        // change tldraw page
        app.changePage(pageObject.id);
        // change dyte store page
        const PageStore = plugin.stores.get('page');
        PageStore.set('currentPage', pageObject)   
    }

    // update pages when store changes come
    useEffect(() => {
        if (!plugin || !app) return;

        const PageStore = plugin.stores.create('page', storeConf);
        PageStore.subscribe('*', (data: any) => {
            const pId = Object.keys(data)[0];
            if (!data[pId]) {
                setPages((p: any) => p.filter((x: any) => x.id !== pId));
                app.deletePage(pId);
            }
            const currentPage = data.currentPage;
            if (!currentPage) return;
            if (!loading) {
                const p = app.getPage(currentPage.id);
                if (!p) {
                    setPages((p: any) => [...p, currentPage]);
                    app.createPage(currentPage.id, currentPage.name);
                    setIndex(INDEX + 1);
                } else {
                    app.changePage(currentPage.id);
                }
            }
            setPage(currentPage);
        })
        return () => {
            PageStore.unsubscribe('*');
        }
    }, [loading, app, plugin])

    return (
        <div className={ config?.darkMode ? "pagination-dark" : "pagination"}>
            <div className="pagination-header" onClick={() => {
                setShowDropdown((s) => !s);
            }}>
                <div>{page?.name}</div>
                <Icon
                    icon={showDropdown ? 'less' : 'more'} className="pagination-icon"
                />
            </div>
            {
                showDropdown && (
                <div className={config?.darkMode ? "pagination-dropdown-dark" : "pagination-dropdown"}>
                    {
                        pages.map((p: any) => (
                            <div
                                key={p.id} 
                                className="pagination-element"
                            >
                                    <div className="page-label" onClick={() => switchPage(p)} >{p.name}</div>
                                    {pages.length > 1 && (
                                        <Icon 
                                            icon="delete" 
                                            onClick={() => deletePage(p.id)}
                                            className="pagination-icon" 
                                        />
                                    )}
                            </div>
                        ))
                    }
                    <div className={config?.darkMode ? "pagination-create-dark" : "pagination-create"} onClick={addPage}>
                        Create Page
                        <Icon icon="add" className="pagination-icon" />
                    </div>
                </div>
                )
            }
        </div>
    )
}

export default index