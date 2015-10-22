package com.slipteama.ubervest;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;

import com.firebase.client.Firebase;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Random;
import java.util.UUID;

/**
 * Created by jon on 20/10/15.
 */
public class BluetoothThread extends Thread {
    private final BluetoothServerSocket serverSocket;

    public BluetoothThread(BluetoothAdapter adapter) {
        BluetoothServerSocket temp = null;
        UUID uuid = UUID.fromString("24a0d83a-4255-41de-b875-eaa3edd23549");
        try {
            temp = adapter.listenUsingRfcommWithServiceRecord("ubervest", uuid);
        } catch(IOException e) {}

        serverSocket = temp;
    }

    public void run() {
        BluetoothSocket socket;
        while(true) {
            try {
                socket = serverSocket.accept();
            } catch (IOException e) {
                break;
            }

            if (socket != null) {
                listenOnSocket(socket);
                try {
                    serverSocket.close();
                } catch (IOException e) {
                }
                break;
            }
        }
    }
    public void cancel() {
        try {
            serverSocket.close();
        } catch (IOException e) { }
    }

    public void listenOnSocket(BluetoothSocket socket) {
        Firebase ref = new Firebase("https://torrid-inferno-6335.firebaseio.com/");
        InputStream inputStream = null;
        byte[] buffer = new byte[8];
        int bytes;

        try {
            inputStream = socket.getInputStream();
        } catch (IOException e) {

        }
        while(true) {
            try {
                bytes = inputStream.read(buffer);
                if(bytes > 0) {
                    ByteBuffer wrapped = ByteBuffer.wrap(buffer);
                    SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy_HH:mm:ss:SSS");
                    String currentDateandTime = sdf.format(new Date());
                    ref.child(currentDateandTime).setValue(wrapped.getInt(0));
                }
            } catch (IOException e) {
                break;
            }
        }
    }
}
