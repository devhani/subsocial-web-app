import React, { FunctionComponent, useEffect } from 'react';
import { ReactiveBase } from '@appbaseio/reactivesearch';
import { AllElasticIndexes } from '../config/ElasticConfig';
import { Layout } from 'antd';
import { isBrowser } from 'react-device-detect';
import { useSidebarCollapsed } from '../components/utils/SideBarCollapsedContext';
import { Drawer } from 'antd-mobile';
import { newLogger } from '@subsocial/utils';
import { isHomePage } from 'src/components/utils';
import { ElasticNodeURL } from 'src/components/utils/env';

import Menu from './SideMenu';
import dynamic from 'next/dynamic';
const TopMenu = dynamic(() => import('./TopMenu'), { ssr: false });

const log = newLogger('Navigation')

const { Header, Sider, Content } = Layout;

interface Props {
  children: React.ReactNode;
}

log.debug('Are we in a browser?', isBrowser);

const HomeNav = () => {
  const { state: { collapsed } } = useSidebarCollapsed();
  return <Sider
    className='DfSider'
    width='255'
    trigger={null}
    collapsible
    collapsed={collapsed}
    defaultCollapsed={false}
  >
    <Menu />
  </Sider>;
};

const DefaultNav: FunctionComponent = ({ children }) => {
  const { state: { collapsed }, toggle, hide } = useSidebarCollapsed();

  useEffect(() => hide(), [ false ])

  return <Drawer
    className='DfSideBar'
    enableDragHandle
    contentStyle={{ color: '#a6a6a6', textAlign: 'center', paddingTop: 42 }}
    sidebar={<div onMouseLeave={hide}><Menu /></div>}
    open={!collapsed}
    onOpenChange={toggle}
  >
    {children}
  </Drawer>;
};

export const Navigation = (props: Props): JSX.Element => {
  const { children } = props;

  const MainContent = () => <Content className='DfPageContent'>{children}</Content>;

  return <ReactiveBase
    className='fontSizeNormal'
    url={ElasticNodeURL}
    app={AllElasticIndexes.join(',')}
  >
    <Layout>
      <Header className='DfHeader'>
        <TopMenu />
      </Header>
      <Layout>
        {isHomePage() && isBrowser
          ? <>
            <HomeNav />
            <MainContent />
          </>
          : <DefaultNav>
            <MainContent />
          </DefaultNav>
        }
      </Layout>
    </Layout>
  </ReactiveBase>;
};
