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

package io.cellery.observability.tracing.receiver.internal;

import io.cellery.observability.tracing.receiver.Constants;
import io.cellery.observability.tracing.receiver.generated.thrift.Annotation;
import io.cellery.observability.tracing.receiver.generated.thrift.BinaryAnnotation;
import io.cellery.observability.tracing.receiver.generated.thrift.Span;
import org.apache.log4j.Logger;
import org.apache.thrift.TException;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.transport.TMemoryBuffer;
import org.apache.thrift.transport.TTransport;
import zipkin2.SpanBytesDecoderDetector;
import zipkin2.codec.BytesDecoder;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Codec used for decoding tracing data.
 */
public class Codec {

    private static final Logger logger = Logger.getLogger(Codec.class.getName());

    /**
     * Decode a default byte array.
     *
     * @param byteArray The byte array to decode
     * @return spans list
     */
    public static List<ZipkinSpan> decodeData(byte[] byteArray) {
        BytesDecoder<zipkin2.Span> spanBytesDecoder = SpanBytesDecoderDetector.decoderForListMessage(byteArray);
        if (logger.isDebugEnabled()) {
            logger.debug("Using " + spanBytesDecoder.getClass().getName() + " decoder for received tracing data");
        }
        List<zipkin2.Span> zipkin2Spans = spanBytesDecoder.decodeList(byteArray);

        List<ZipkinSpan> spans = new ArrayList<>();
        for (zipkin2.Span zipkin2Span : zipkin2Spans) {
            ZipkinSpan span = new ZipkinSpan();
            span.setTraceId(zipkin2Span.traceId());
            span.setId(zipkin2Span.id());
            span.setParentId(zipkin2Span.parentId());
            span.setName(zipkin2Span.name());
            span.setServiceName(zipkin2Span.localServiceName() != null ? zipkin2Span.localServiceName() : "");
            span.setKind(zipkin2Span.kind() != null ? zipkin2Span.kind().toString() : "");
            span.setTimestamp(zipkin2Span.timestampAsLong());
            span.setDuration(zipkin2Span.durationAsLong());
            span.setTags(zipkin2Span.tags());
            spans.add(span);
        }
        return spans;
    }

    /**
     * Decode a thrift tracing message.
     *
     * @param byteArray The byte array to decode
     * @return spans list
     */
    public static List<ZipkinSpan> decodeThriftData(byte[] byteArray) throws TException {
        TTransport transport = new TMemoryBuffer(byteArray.length);
        transport.write(byteArray);

        TProtocol tProtocol = new TBinaryProtocol(transport);
        int size = tProtocol.readListBegin().size;

        List<ZipkinSpan> spans = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            Span tSpan = new Span();
            tSpan.read(tProtocol);

            // Using Zipkin Builder to do the required additional processing
            zipkin2.Span zipkin2Span = zipkin2.Span.newBuilder()
                    .traceId(tSpan.getTrace_id_high(), tSpan.getTrace_id())
                    .id(tSpan.getId())
                    .parentId(tSpan.getParent_id())
                    .build();

            // Getting the span kind from the local annotation
            String serviceName;
            String localAnnotationValue;
            if (tSpan.getAnnotations().size() > 0) {
                // The first annotation is the local annotations
                Annotation localAnnotation = tSpan.getAnnotations().get(0);
                localAnnotationValue = localAnnotation.getValue();
                serviceName = localAnnotation.getHost().getService_name();
            } else {
                localAnnotationValue = "";
                serviceName = "";
            }
            String kind;
            switch (localAnnotationValue) {
                case Constants.THRIFT_SPAN_ANNOTATION_VALUE_CLIENT_SEND:
                case Constants.THRIFT_SPAN_ANNOTATION_VALUE_CLIENT_RECEIVE:
                    kind = Constants.CLIENT_SPAN_KIND;
                    break;
                case Constants.THRIFT_SPAN_ANNOTATION_VALUE_SERVER_SEND:
                case Constants.THRIFT_SPAN_ANNOTATION_VALUE_SERVER_RECEIVE:
                    kind = Constants.SERVER_SPAN_KIND;
                    break;
                case Constants.THRIFT_SPAN_ANNOTATION_VALUE_PRODUCER_SEND:
                    kind = Constants.PRODUCER_SPAN_KIND;
                    break;
                case Constants.THRIFT_SPAN_ANNOTATION_VALUE_CONSUMER_RECEIVER:
                    kind = Constants.CONSUMER_SPAN_KIND;
                    break;
                default:
                    kind = "";
            }

            // Converting the binary annotations list to a tags map
            Map<String, String> tags = new HashMap<>();
            for (BinaryAnnotation binaryAnnotation : tSpan.getBinary_annotations()) {
                String tagValue;
                switch (binaryAnnotation.getAnnotation_type()) {
                    case STRING:
                        tagValue = new String(binaryAnnotation.getValue(), StandardCharsets.UTF_8);
                        break;
                    case BOOL:
                        tagValue = Boolean.toString(binaryAnnotation.getValue()[0] == 1);
                        break;
                    case DOUBLE:
                        tagValue = Double.toString(ByteBuffer.wrap(binaryAnnotation.getValue()).getDouble());
                        break;
                    case I64:
                        tagValue = Long.toString(ByteBuffer.wrap(binaryAnnotation.getValue()).getLong());
                        break;
                    case I32:
                        tagValue = Integer.toString(ByteBuffer.wrap(binaryAnnotation.getValue()).getInt());
                        break;
                    case I16:
                        tagValue = Short.toString(ByteBuffer.wrap(binaryAnnotation.getValue()).getShort());
                        break;
                    default:
                        tagValue = null;
                }
                if (tagValue != null) {
                    tags.put(binaryAnnotation.getKey(), tagValue);
                }
            }

            ZipkinSpan span = new ZipkinSpan();
            span.setTraceId(zipkin2Span.traceId());
            span.setId(zipkin2Span.id());
            span.setParentId(zipkin2Span.parentId());
            span.setName(tSpan.getName());
            span.setServiceName(serviceName);
            span.setKind(kind);
            span.setTimestamp(tSpan.getTimestamp());
            span.setDuration(tSpan.getDuration());
            span.setTags(tags);
            spans.add(span);
        }
        return spans;
    }

    private Codec() {   // Prevent initialization
    }
}
