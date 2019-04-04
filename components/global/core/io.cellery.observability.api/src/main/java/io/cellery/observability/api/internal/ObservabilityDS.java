/*
 * Copyright (c) 2019, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package io.cellery.observability.api.internal;

import io.cellery.observability.api.AggregatedRequestsAPI;
import io.cellery.observability.api.DependencyModelAPI;
import io.cellery.observability.api.DistributedTracingAPI;
import io.cellery.observability.api.KubernetesAPI;
import io.cellery.observability.api.TrustAllX509TrustManager;
import io.cellery.observability.api.UserAuthenticationAPI;
import io.cellery.observability.api.bean.CelleryConfig;
import io.cellery.observability.api.exception.mapper.APIExceptionMapper;
import io.cellery.observability.api.interceptor.AuthInterceptor;
import io.cellery.observability.api.interceptor.CORSInterceptor;
import io.cellery.observability.api.registeration.IdpClientApp;
import io.cellery.observability.api.siddhi.SiddhiStoreQueryManager;
import io.cellery.observability.model.generator.ModelManager;
import org.apache.log4j.Logger;
import org.json.JSONObject;
import org.osgi.framework.BundleContext;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Deactivate;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.component.annotations.ReferenceCardinality;
import org.osgi.service.component.annotations.ReferencePolicy;
import org.wso2.carbon.config.provider.ConfigProvider;
import org.wso2.carbon.datasource.core.api.DataSourceService;
import org.wso2.carbon.kernel.CarbonRuntime;
import org.wso2.msf4j.MicroservicesRunner;

import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;

/**
 * This is the declarative service component of the observability API component,
 * which is responsible for listening on the required osgi services and exposing the services so that
 * other components can use them.
 */
@Component(
        name = "org.wso2.carbon.governance.dependency.model.internal.ObservabilityDS",
        immediate = true
)
public class ObservabilityDS {

    private static final Logger log = Logger.getLogger(ObservabilityDS.class);

    private static final int DEFAULT_OBSERVABILITY_API_PORT = 9123;

    /**
     * This is the activation method of ObservabilityDS. This will be called when its references are
     * satisfied.
     *
     * @param bundleContext the bundle context instance of this bundle.
     * @throws Exception this will be thrown if an issue occurDataSourceServices while executing the activate method
     */
    @Activate
    protected void start(BundleContext bundleContext) throws Exception {

        JSONObject clientJson = IdpClientApp.getClientCredentials();
        log.info(clientJson.getString("client_id"));
        disableSSLVerification();
        final char[] clientId = clientJson.getString("client_id").toCharArray();
        final char[] clientSecret = clientJson.getString("client_secret").toCharArray();
        UserAuthenticationAPI.setClientId(clientId);
        UserAuthenticationAPI.setClientSecret(clientSecret);
        try {
            // Deploying the microservices
            int offset = ServiceHolder.getCarbonRuntime().getConfiguration().getPortsConfig().getOffset();
            ServiceHolder.setMicroservicesRunner(new MicroservicesRunner(DEFAULT_OBSERVABILITY_API_PORT + offset)
                    .addGlobalRequestInterceptor(new CORSInterceptor(), new AuthInterceptor())
                    .addExceptionMapper(new APIExceptionMapper())
                    .deploy(
                            new DependencyModelAPI(), new AggregatedRequestsAPI(), new DistributedTracingAPI(),
                            new KubernetesAPI(), new UserAuthenticationAPI()
                    )
            );
            ServiceHolder.getMicroservicesRunner().start();

            // Starting the Siddhi Manager
            ServiceHolder.setSiddhiStoreQueryManager(new SiddhiStoreQueryManager());
        } catch (Throwable throwable) {
            log.error("Error occured while activating the Observability API bundle", throwable);
            throw throwable;
        }
    }

    /**
     * This is the deactivation method of ObservabilityDS. This will be called when this component
     * is being stopped or references are satisfied during runtime.
     *
     * @throws Exception this will be thrown if an issue occurs while executing the de-activate method
     */
    @Deactivate
    protected void stop() throws Exception {
        ServiceHolder.getMicroservicesRunner().stop();
        if (log.isDebugEnabled()) {
            log.debug("Successfully stopped Microservices");
        }

        ServiceHolder.getSiddhiStoreQueryManager().stop();
        if (log.isDebugEnabled()) {
            log.debug("Successfully stopped Siddhi Query manager");
        }
    }

    @Reference(
            name = "carbon.runtime.service",
            service = CarbonRuntime.class,
            cardinality = ReferenceCardinality.MANDATORY,
            policy = ReferencePolicy.DYNAMIC,
            unbind = "unsetCarbonRuntime"
    )
    protected void setCarbonRuntime(CarbonRuntime carbonRuntime) {
        ServiceHolder.setCarbonRuntime(carbonRuntime);
    }

    protected void unsetCarbonRuntime(CarbonRuntime carbonRuntime) {
        ServiceHolder.setCarbonRuntime(null);
    }

    @Reference(
            name = "org.wso2.carbon.datasource.core",
            service = DataSourceService.class,
            cardinality = ReferenceCardinality.MANDATORY,
            policy = ReferencePolicy.DYNAMIC,
            unbind = "unsetDataSourceService"
    )
    protected void setDataSourceService(DataSourceService dataSourceService) {
        /*
         * This is not directly used by this component. However, the Siddhi Store RDBMS extension requires this.
         * Therefore this is added to make sure the data source service is available before this bundle is activated
         */
    }

    protected void unsetDataSourceService(DataSourceService dataSourceService) {
    }

    @Reference(
            name = "io.cellery.observability.model.generator.ModelManager",
            service = ModelManager.class,
            cardinality = ReferenceCardinality.MANDATORY,
            policy = ReferencePolicy.DYNAMIC,
            unbind = "unsetModelManager"
    )
    protected void setModelManager(ModelManager modelManager) {
        ServiceHolder.setModelManager(modelManager);
    }

    protected void unsetModelManager(ModelManager modelManager) {
        ServiceHolder.setCarbonRuntime(null);
    }

    @Reference(
            name = "carbon.config.provider",
            service = ConfigProvider.class,
            cardinality = ReferenceCardinality.MANDATORY,
            policy = ReferencePolicy.DYNAMIC,
            unbind = "unregisterConfigProvider"
    )
    protected void registerConfigProvider(ConfigProvider configProvider) {

        CelleryConfig.setConfigProvider(configProvider);
    }

    protected void unregisterConfigProvider(ConfigProvider configProvider) {
        CelleryConfig.setConfigProvider(null);
    }

    private static void disableSSLVerification() {
        try {
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, new TrustManager[]{new TrustAllX509TrustManager()}, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier(new HostnameVerifier() {
                public boolean verify(String string, SSLSession ssls) {
                    return true;
                }
            });
        } catch (NoSuchAlgorithmException | KeyManagementException e) {
            log.error("Error occured while disabling SSL verification", e);
        }
    }

}
